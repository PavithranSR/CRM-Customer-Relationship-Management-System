import "server-only";

import { differenceInCalendarDays } from "date-fns";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";

export type CrmPivotMeasure =
  | "expectedRevenue"
  | "wonRevenue"
  | "leadCount"
  | "daysToClose"
  | "daysToConvert"
  | "exceededClosingDays"
  | "proratedRevenue";

export type CrmPivotGroupBy = "month" | "country" | "salesperson" | "team" | "stage" | "leadSource";

export interface CrmPivotReportingFilters {
  startDate?: string;
  endDate?: string;
  country?: string;
  stage?: string;
  salesperson?: string;
  team?: string;
}

interface ReportingUserContext {
  id: string;
  role: Role | string;
  permissions: unknown;
}

interface MatchedClient {
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

interface QuotationMetricRow {
  crmLeadId: string;
  createdAt: Date;
  totalAmount: number;
}

interface PivotUserRef {
  id: string;
  name: string | null;
  department: string | null;
  role: Role;
}

export interface CrmPivotLeadRow {
  id: string;
  title: string;
  clientName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  state: string;
  stage: string;
  stageKey: string;
  salesperson: string;
  salespersonId: string;
  team: string;
  leadSource: string;
  campaign: string;
  expectedRevenue: number;
  wonRevenue: number;
  daysToClose: number | null;
  daysToConvert: number | null;
  exceededClosingDays: number | null;
  proratedRevenue: number;
  probabilityPercent: number;
  isWon: boolean;
  isLost: boolean;
  createdAt: Date;
  updatedAt: Date;
  expectedClosingDate: Date | null;
  convertedAt: Date | null;
  closedAt: Date | null;
  href: string;
}

export interface CrmPivotReportingData {
  filters: {
    startDate: string;
    endDate: string;
    country: string;
    stage: string;
    salesperson: string;
    team: string;
  };
  options: {
    countries: string[];
    stages: string[];
    salespeople: Array<{ id: string; name: string }>;
    teams: string[];
  };
  measures: Array<{ key: CrmPivotMeasure; label: string }>;
  groupings: Array<{ key: CrmPivotGroupBy; label: string }>;
  overview: {
    totalLeads: number;
    totalExpectedRevenue: number;
    wonDeals: number;
    lostDeals: number;
    averageDaysToClose: number;
    conversionRate: number;
  };
  rows: CrmPivotLeadRow[];
}

const CLIENT_META_PREFIX = "__client_meta__:";
const UNASSIGNED_SALESPERSON_ID = "__unassigned__";

const CRM_PIVOT_MEASURES: Array<{ key: CrmPivotMeasure; label: string }> = [
  { key: "expectedRevenue", label: "Expected Revenue" },
  { key: "wonRevenue", label: "Won Revenue" },
  { key: "leadCount", label: "Lead Count" },
  { key: "daysToClose", label: "Days to Close" },
  { key: "daysToConvert", label: "Days to Convert" },
  { key: "exceededClosingDays", label: "Exceeded Closing Days" },
  { key: "proratedRevenue", label: "Prorated Revenue" },
];

const CRM_PIVOT_GROUPS: Array<{ key: CrmPivotGroupBy; label: string }> = [
  { key: "month", label: "Month" },
  { key: "country", label: "Country" },
  { key: "salesperson", label: "Salesperson" },
  { key: "team", label: "Team" },
  { key: "stage", label: "Stage" },
  { key: "leadSource", label: "Lead Source" },
];

function parseDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

function humanizeToken(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) return "";

  return normalized
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function probabilityPercent(level: number | null | undefined) {
  if (level === 3) return 75;
  if (level === 2) return 50;
  return 25;
}

function parseTagMap(tags: string | null | undefined) {
  const map: Record<string, string> = {};
  if (!tags) return map;

  const markerIndex = tags.indexOf(CLIENT_META_PREFIX);
  const plainTags = markerIndex >= 0 ? tags.slice(0, markerIndex) : tags;

  plainTags
    .split(/[|,;\n]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .forEach((token) => {
      const [rawKey, ...rest] = token.split(":");
      if (!rawKey || rest.length === 0) return;
      map[rawKey.trim().toLowerCase()] = rest.join(":").trim();
    });

  return map;
}

function parseClientMetaFromTags(tags: string | null | undefined) {
  if (!tags) return null;

  const markerIndex = tags.indexOf(CLIENT_META_PREFIX);
  if (markerIndex === -1) return null;

  const payload = tags.slice(markerIndex + CLIENT_META_PREFIX.length).trim();
  if (!payload) return null;

  try {
    return JSON.parse(payload) as {
      city?: string;
      state?: string;
      country?: string;
    };
  } catch {
    return null;
  }
}

function readLeadTagValue(tags: string | null | undefined, aliases: string[]) {
  const clientMeta = parseClientMetaFromTags(tags);
  if (clientMeta) {
    for (const alias of aliases) {
      const metaValue = clientMeta[alias as keyof typeof clientMeta];
      if (typeof metaValue === "string" && metaValue.trim()) {
        return metaValue.trim();
      }
    }
  }

  const tagMap = parseTagMap(tags);
  for (const alias of aliases) {
    const direct = tagMap[alias.toLowerCase()];
    if (direct) {
      return direct;
    }
  }

  return "";
}

function matchStageLabel(label: string, kind: "qualified" | "won" | "lost") {
  const normalized = label.trim().toLowerCase();

  if (kind === "qualified") {
    return normalized.includes("qualified") || normalized.includes("proposition") || normalized.includes("proposal");
  }

  if (kind === "won") {
    return normalized.includes("won") || normalized.includes("completed") || normalized.includes("done");
  }

  return (
    normalized.includes("lost") ||
    normalized.includes("cancel") ||
    normalized.includes("archived") ||
    normalized.includes("deleted") ||
    normalized.includes("rejected")
  );
}

function scopedWhere(allowedCreatorIds: string[] | null) {
  if (allowedCreatorIds === null) return {};
  if (allowedCreatorIds.length === 0) {
    return { id: { equals: "__no_records__" } };
  }

  return {
    OR: [
      { createdById: { in: allowedCreatorIds } },
      { ownerId: { in: allowedCreatorIds } },
    ],
  };
}

function resolveSalespersonRef(owner: PivotUserRef | null, createdBy: PivotUserRef | null) {
  const activeRef = owner ?? createdBy;
  if (!activeRef) {
    return {
      id: UNASSIGNED_SALESPERSON_ID,
      name: "Unassigned",
      team: "Unassigned",
    };
  }

  return {
    id: activeRef.id || UNASSIGNED_SALESPERSON_ID,
    name: activeRef.name?.trim() || "Unassigned",
    team: activeRef.department?.trim() || `${humanizeToken(activeRef.role)} Team`,
  };
}

function findMatchingClient(
  lead: {
    title: string;
    clientName: string | null;
    email: string | null;
    phone: string | null;
  },
  maps: {
    byEmail: Map<string, MatchedClient>;
    byPhone: Map<string, MatchedClient>;
    byName: Map<string, MatchedClient>;
  },
) {
  const byEmail = maps.byEmail.get(normalizeText(lead.email));
  if (byEmail) return byEmail;

  const byPhone = maps.byPhone.get(normalizePhone(lead.phone));
  if (byPhone) return byPhone;

  return maps.byName.get(normalizeText(lead.clientName || lead.title)) || null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export async function getCrmPivotReportingData(
  rawFilters: CrmPivotReportingFilters,
  user: ReportingUserContext,
): Promise<CrmPivotReportingData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = parseDate(rawFilters.startDate, monthStart);
  const endDate = parseDate(rawFilters.endDate, now);
  endDate.setHours(23, 59, 59, 999);

  const filters = {
    startDate: toInputDate(startDate),
    endDate: toInputDate(endDate),
    country: rawFilters.country || "",
    stage: rawFilters.stage || "",
    salesperson: rawFilters.salesperson || "",
    team: rawFilters.team || "",
  };

  const allowedCreatorIds = await getCrmAllowedCreatorIds(user.id, user.role, user.permissions);

  const [leadRowsRaw, stageRows] = await Promise.all([
    db.crmLead.findMany({
      where: {
        ...scopedWhere(allowedCreatorIds),
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        email: true,
        phone: true,
        value: true,
        probabilityLevel: true,
        stage: true,
        tags: true,
        expectedClosingDate: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        ownerId: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            department: true,
            role: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            department: true,
            role: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.crmStage.findMany({
      select: {
        key: true,
        label: true,
      },
      orderBy: { position: "asc" },
    }),
  ]);

  const leadIds = leadRowsRaw.map((lead) => lead.id);
  const clientEmails = Array.from(new Set(leadRowsRaw.map((lead) => lead.email).filter(Boolean))) as string[];
  const clientNames = Array.from(
    new Set(
      leadRowsRaw
        .map((lead) => lead.clientName || lead.title)
        .filter((value): value is string => Boolean(value?.trim())),
    ),
  );
  const clientPhones = Array.from(new Set(leadRowsRaw.map((lead) => lead.phone).filter(Boolean))) as string[];

  const clientWhereOr: Array<Record<string, unknown>> = [];
  if (clientEmails.length > 0) {
    clientWhereOr.push({ email: { in: clientEmails } });
  }
  if (clientNames.length > 0) {
    clientWhereOr.push({ name: { in: clientNames } });
  }
  if (clientPhones.length > 0) {
    clientWhereOr.push({ phone: { in: clientPhones } });
  }

  const [clientsRaw, quotationMetricsRaw] = await Promise.all([
    clientWhereOr.length === 0
      ? Promise.resolve([] as MatchedClient[])
      : db.client.findMany({
          where: {
            isActive: true,
            OR: clientWhereOr as never,
          },
          select: {
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
            country: true,
          },
        }),
    leadIds.length === 0
      ? Promise.resolve([] as QuotationMetricRow[])
      : db.crmQuotation.findMany({
          where: {
            crmLeadId: { in: leadIds },
          },
          select: {
            crmLeadId: true,
            createdAt: true,
            totalAmount: true,
          },
          orderBy: [{ createdAt: "asc" }],
        }).then((rows) =>
          rows.map((row) => ({
            crmLeadId: row.crmLeadId,
            createdAt: row.createdAt,
            totalAmount: Number(row.totalAmount || 0),
          })),
        ),
  ]);

  const stageLabelByKey = stageRows.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const quotationsByLeadId = quotationMetricsRaw.reduce<Map<string, QuotationMetricRow[]>>((acc, row) => {
    const current = acc.get(row.crmLeadId) || [];
    current.push(row);
    acc.set(row.crmLeadId, current);
    return acc;
  }, new Map());

  const clientsByEmail = new Map<string, MatchedClient>();
  const clientsByPhone = new Map<string, MatchedClient>();
  const clientsByName = new Map<string, MatchedClient>();

  clientsRaw.forEach((client) => {
    const emailKey = normalizeText(client.email);
    const phoneKey = normalizePhone(client.phone);
    const nameKey = normalizeText(client.name);

    if (emailKey) {
      clientsByEmail.set(emailKey, client);
    }
    if (phoneKey) {
      clientsByPhone.set(phoneKey, client);
    }
    if (nameKey && !clientsByName.has(nameKey)) {
      clientsByName.set(nameKey, client);
    }
  });

  const baseRows: CrmPivotLeadRow[] = leadRowsRaw.map((lead) => {
    const matchingClient = findMatchingClient(lead, {
      byEmail: clientsByEmail,
      byPhone: clientsByPhone,
      byName: clientsByName,
    });
    const leadQuotations = quotationsByLeadId.get(lead.id) || [];
    const earliestQuotation = leadQuotations[0] || null;
    const latestQuotation = leadQuotations[leadQuotations.length - 1] || null;
    const salespersonRef = resolveSalespersonRef(lead.owner, lead.createdBy);
    const stageLabel = stageLabelByKey[lead.stage] || humanizeToken(lead.stage) || "No Stage";
    const isWon = matchStageLabel(stageLabel, "won");
    const isLost = matchStageLabel(stageLabel, "lost");
    const isQualified = matchStageLabel(stageLabel, "qualified");
    const closedAt = isWon || isLost ? lead.updatedAt : null;
    const convertedAt = earliestQuotation?.createdAt || (isQualified || isWon ? lead.updatedAt : null);
    const expectedRevenue = Number(lead.value ?? latestQuotation?.totalAmount ?? 0);
    const wonRevenue = isWon ? Number(latestQuotation?.totalAmount ?? lead.value ?? 0) : 0;
    const chance = probabilityPercent(lead.probabilityLevel);
    const locationCity =
      readLeadTagValue(lead.tags, ["city", "clientCity", "addressCity"]) ||
      matchingClient?.city?.trim() ||
      "";
    const locationState =
      readLeadTagValue(lead.tags, ["state", "province", "region", "clientState", "addressState"]) ||
      matchingClient?.state?.trim() ||
      "";
    const locationCountry =
      readLeadTagValue(lead.tags, ["country", "clientCountry", "addressCountry", "nation"]) ||
      matchingClient?.country?.trim() ||
      "";
    const leadSource =
      readLeadTagValue(lead.tags, ["source", "lead-source", "leadSourceType"]) || "Unknown Source";
    const campaign = readLeadTagValue(lead.tags, ["campaign"]) || "-";

    return {
      id: lead.id,
      title: lead.title || lead.clientName || "Opportunity",
      clientName: lead.clientName || lead.title || "Unnamed Lead",
      email: lead.email || "-",
      phone: lead.phone || "-",
      country: locationCountry || "Unknown Country",
      city: locationCity || "Unknown City",
      state: locationState || "Unknown State",
      stage: stageLabel || "No Stage",
      stageKey: lead.stage || "no-stage",
      salesperson: salespersonRef.name || "Unassigned",
      salespersonId: salespersonRef.id || UNASSIGNED_SALESPERSON_ID,
      team: salespersonRef.team || "Unassigned",
      leadSource,
      campaign,
      expectedRevenue,
      wonRevenue,
      daysToClose: closedAt ? Math.max(0, differenceInCalendarDays(closedAt, lead.createdAt)) : null,
      daysToConvert: convertedAt ? Math.max(0, differenceInCalendarDays(convertedAt, lead.createdAt)) : null,
      exceededClosingDays: lead.expectedClosingDate
        ? Math.max(0, differenceInCalendarDays(closedAt ?? now, lead.expectedClosingDate))
        : null,
      proratedRevenue: isWon ? wonRevenue : expectedRevenue * (chance / 100),
      probabilityPercent: chance,
      isWon,
      isLost,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      expectedClosingDate: lead.expectedClosingDate,
      convertedAt,
      closedAt,
      href: `/crm/${lead.id}`,
    };
  });

  const rows = baseRows.filter((row) => {
    const countryMatch = !filters.country || normalizeText(row.country) === normalizeText(filters.country);
    const stageMatch = !filters.stage || normalizeText(row.stage) === normalizeText(filters.stage);
    const salespersonMatch = !filters.salesperson || row.salespersonId === filters.salesperson;
    const teamMatch = !filters.team || normalizeText(row.team) === normalizeText(filters.team);
    return countryMatch && stageMatch && salespersonMatch && teamMatch;
  });

  const totalLeads = rows.length;
  const totalExpectedRevenue = rows.reduce((sum, row) => sum + row.expectedRevenue, 0);
  const wonDeals = rows.filter((row) => row.isWon).length;
  const lostDeals = rows.filter((row) => row.isLost).length;
  const averageDaysToClose = average(
    rows
      .map((row) => row.daysToClose)
      .filter((value): value is number => value !== null),
  );

  return {
    filters,
    options: {
      countries: Array.from(new Set(baseRows.map((row) => row.country))).sort((a, b) => a.localeCompare(b)),
      stages: Array.from(new Set(baseRows.map((row) => row.stage))).sort((a, b) => a.localeCompare(b)),
      salespeople: Array.from(
        baseRows.reduce<Map<string, string>>((acc, row) => {
          acc.set(row.salespersonId, row.salesperson);
          return acc;
        }, new Map()).entries(),
      )
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      teams: Array.from(new Set(baseRows.map((row) => row.team))).sort((a, b) => a.localeCompare(b)),
    },
    measures: CRM_PIVOT_MEASURES,
    groupings: CRM_PIVOT_GROUPS,
    overview: {
      totalLeads,
      totalExpectedRevenue,
      wonDeals,
      lostDeals,
      averageDaysToClose,
      conversionRate: totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0,
    },
    rows,
  };
}
