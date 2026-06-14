import "server-only";

import { db } from "@/lib/db";
import { getCrmAllowedCreatorIds } from "@/lib/crm-record-rules.server";
import type { Role } from "@prisma/client";

export interface CrmReportingFilters {
  startDate?: string;
  endDate?: string;
  salesperson?: string;
  customer?: string;
  status?: string;
  product?: string;
  campaign?: string;
  company?: string;
  groupBy?: "stage" | "month" | "user";
  section?: "overview" | "crm" | "quotations" | "invoices";
}

interface ReportingUserContext {
  id: string;
  role: Role | string;
  permissions: unknown;
}

interface CrmReportingOptions {
  basePath?: string;
}

interface LeadRow {
  id: string;
  title: string;
  clientName: string | null;
  value: number | null;
  stageKey: string;
  stageLabel: string | null;
  tags: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  salespersonName: string | null;
}

interface QuotationRow {
  id: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  clientName: string;
  projectTitle: string;
  serviceName: string | null;
  totalAmount: number;
  status: string;
  createdAt: Date;
  createdById: string;
  salespersonName: string | null;
}

interface InvoiceRow {
  invoiceId: string;
  quotationId: string;
  crmLeadId: string;
  quotationNo: string;
  clientName: string;
  salespersonId: string | null;
  salespersonName: string | null;
  serviceName: string | null;
  projectTitle: string;
  quotationStatus: string;
  invoiceTotal: number;
  paidAmount: number;
  balanceAmount: number;
  validUntil: Date | null;
  invoiceCreatedAt: Date;
}

export interface ReportingLinkItem {
  label: string;
  href: string;
}

export interface CrmReportingData {
  filters: {
    startDate: string;
    endDate: string;
    salesperson: string;
    customer: string;
    status: string;
    product: string;
    campaign: string;
    company: string;
    groupBy: "stage" | "month" | "user";
    section: "overview" | "crm" | "quotations" | "invoices";
  };
  options: {
    salespeople: Array<{ id: string; name: string }>;
    customers: string[];
    statuses: string[];
    products: string[];
    campaigns: string[];
    companies: string[];
  };
  overview: {
    totalLeads: number;
    totalQuotations: number;
    totalConfirmedOrders: number;
    totalRevenue: number;
    conversionRate: number;
    monthlySales: Array<{ label: string; value: number; href: string }>;
    quotationsByStatus: Array<{ label: string; value: number; href: string }>;
    leadsByStage: Array<{ label: string; value: number; href: string }>;
    topCustomers: Array<{ label: string; value: number; secondary: string; href: string }>;
  };
  crm: {
    totalLeads: number;
    qualifiedLeads: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    leadsByStage: Array<{ label: string; value: number; href: string }>;
    leadsBySource: Array<{ label: string; value: number; href: string }>;
    leadsBySalesperson: Array<{ label: string; value: number; href: string }>;
    monthlyLeadTrend: Array<{ label: string; value: number; href: string }>;
    detailRows: Array<{
      id: string;
      title: string;
      customer: string;
      stage: string;
      salesperson: string;
      campaign: string;
      source: string;
      value: number;
      createdAt: Date;
      href: string;
    }>;
  };
  quotations: {
    total: number;
    draft: number;
    sent: number;
    confirmed: number;
    rejected: number;
    averageValue: number;
    byMonth: Array<{ label: string; value: number; href: string }>;
    bySalesperson: Array<{ label: string; value: number; href: string }>;
    byCustomer: Array<{ label: string; value: number; href: string }>;
    detailRows: Array<{
      id: string;
      quotationNo: string;
      title: string;
      customer: string;
      salesperson: string;
      status: string;
      amount: number;
      createdAt: Date;
      href: string;
    }>;
  };
  invoices: {
    total: number;
    paid: number;
    unpaid: number;
    overdue: number;
    totalRevenue: number;
    revenueByMonth: Array<{ label: string; value: number; href: string }>;
    paidVsUnpaid: Array<{ label: string; value: number; href: string }>;
    topCustomers: Array<{ label: string; value: number; secondary: string; href: string }>;
    detailRows: Array<{
      id: string;
      invoiceRef: string;
      customer: string;
      salesperson: string;
      status: string;
      paidAmount: number;
      balanceAmount: number;
      totalAmount: number;
      createdAt: Date;
      href: string;
    }>;
  };
}

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

function labelizeMonth(value: Date) {
  return value.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
}

function parseTagMap(tags: string | null | undefined) {
  const map: Record<string, string> = {};
  if (!tags) return map;

  tags
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
    normalized.includes("deleted")
  );
}

function deriveInvoiceStatus(row: InvoiceRow) {
  if (row.balanceAmount <= 0) return "PAID";
  if (row.validUntil && row.validUntil.getTime() < Date.now()) return "OVERDUE";
  return "UNPAID";
}

function buildQuery(params: URLSearchParams) {
  const query = params.toString();
  return query ? `?${query}` : "";
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

export async function getCrmReportingData(
  rawFilters: CrmReportingFilters,
  user: ReportingUserContext,
  options: CrmReportingOptions = {},
): Promise<CrmReportingData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = parseDate(rawFilters.startDate, monthStart);
  const endDate = parseDate(rawFilters.endDate, now);
  endDate.setHours(23, 59, 59, 999);

  const filters = {
    startDate: toInputDate(startDate),
    endDate: toInputDate(endDate),
    salesperson: rawFilters.salesperson || "",
    customer: rawFilters.customer || "",
    status: rawFilters.status || "",
    product: rawFilters.product || "",
    campaign: rawFilters.campaign || "",
    company: rawFilters.company || "",
    groupBy: (rawFilters.groupBy || "month") as "stage" | "month" | "user",
    section: (rawFilters.section || "overview") as "overview" | "crm" | "quotations" | "invoices",
  };
  const reportingBasePath = options.basePath || "/crm/reporting";
  const buildReportingHref = (overrides: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    const merged = {
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      ...overrides,
    };

    Object.entries(merged).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    return `${reportingBasePath}${buildQuery(params)}`;
  };

  const allowedCreatorIds = await getCrmAllowedCreatorIds(user.id, user.role, user.permissions);

  const [leadRowsRaw, quotationRowsRaw, invoiceRowsRaw] = await Promise.all([
    db.crmLead.findMany({
      where: {
        ...scopedWhere(allowedCreatorIds),
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        title: true,
        clientName: true,
        value: true,
        stage: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
        createdById: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.crmQuotation.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        ...(allowedCreatorIds === null
          ? {}
          : allowedCreatorIds.length === 0
            ? { id: "__no_records__" }
            : {
                OR: [
                  { createdById: { in: allowedCreatorIds } },
                  { crmLead: { createdById: { in: allowedCreatorIds } } },
                  { crmLead: { ownerId: { in: allowedCreatorIds } } },
                ],
              }),
      },
      select: {
        id: true,
        crmLeadId: true,
        quotationNo: true,
        title: true,
        clientName: true,
        projectTitle: true,
        serviceName: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.$queryRaw<InvoiceRow[]>`
      SELECT
        i."id" AS "invoiceId",
        q."id" AS "quotationId",
        q."crmLeadId",
        q."quotationNo",
        q."clientName",
        q."createdById" AS "salespersonId",
        u."name" AS "salespersonName",
        q."serviceName",
        q."projectTitle",
        q."status"::text AS "quotationStatus",
        q."totalAmount" AS "invoiceTotal",
        COALESCE(i."amount", 0) AS "paidAmount",
        COALESCE(i."balanceAmount", 0) AS "balanceAmount",
        q."validUntil",
        i."createdAt" AS "invoiceCreatedAt"
      FROM "crm_quotation_invoices" i
      INNER JOIN "crm_quotations" q ON q."id" = i."quotationId"
      LEFT JOIN "users" u ON u."id" = q."createdById"
      WHERE i."createdAt" BETWEEN ${startDate} AND ${endDate}
      ORDER BY i."createdAt" DESC
    `,
  ]);

  const stageMap = await db.crmStage.findMany({
    select: { key: true, label: true },
    orderBy: { position: "asc" },
  });
  const stageLabelByKey = stageMap.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.label;
    return acc;
  }, {});

  const leads: LeadRow[] = leadRowsRaw.map((lead) => ({
    id: lead.id,
    title: lead.title,
    clientName: lead.clientName,
    value: lead.value,
    stageKey: lead.stage,
    stageLabel: stageLabelByKey[lead.stage] || lead.stage,
    tags: lead.tags,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    createdById: lead.createdById,
    salespersonName: lead.createdBy.name,
  }));

  const quotations: QuotationRow[] = quotationRowsRaw.map((quotation) => ({
    id: quotation.id,
    crmLeadId: quotation.crmLeadId,
    quotationNo: quotation.quotationNo,
    title: quotation.title,
    clientName: quotation.clientName,
    projectTitle: quotation.projectTitle,
    serviceName: quotation.serviceName,
    totalAmount: Number(quotation.totalAmount || 0),
    status: quotation.status,
    createdAt: quotation.createdAt,
    createdById: quotation.createdById,
    salespersonName: quotation.createdBy.name,
  }));

  const scopedInvoices = invoiceRowsRaw.filter((row) => {
    if (allowedCreatorIds === null) return true;
    return !!row.salespersonId && allowedCreatorIds.includes(row.salespersonId);
  });

  const salespeopleMap = new Map<string, string>();
  leads.forEach((lead) => {
    if (lead.createdById) {
      salespeopleMap.set(lead.createdById, lead.salespersonName || "Unassigned");
    }
  });
  quotations.forEach((quotation) => {
    if (quotation.createdById) {
      salespeopleMap.set(quotation.createdById, quotation.salespersonName || "Unassigned");
    }
  });
  scopedInvoices.forEach((invoice) => {
    if (invoice.salespersonId) {
      salespeopleMap.set(invoice.salespersonId, invoice.salespersonName || "Unassigned");
    }
  });

  const customers = Array.from(new Set([
    ...leads.map((lead) => lead.clientName || ""),
    ...quotations.map((quotation) => quotation.clientName),
    ...scopedInvoices.map((invoice) => invoice.clientName),
  ].filter(Boolean))).sort((a, b) => a.localeCompare(b));

  const campaigns = Array.from(
    new Set(
      leads
        .map((lead) => parseTagMap(lead.tags).campaign || "")
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const statuses = Array.from(
    new Set([
      ...quotations.map((quotation) => quotation.status),
      ...scopedInvoices.map((invoice) => deriveInvoiceStatus(invoice)),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const products = Array.from(
    new Set(
      quotations
        .map((quotation) => quotation.serviceName || quotation.projectTitle || "")
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filteredLeads = leads.filter((lead) => {
    const tags = parseTagMap(lead.tags);
    const salespersonMatch = !filters.salesperson || lead.createdById === filters.salesperson;
    const customerMatch = !filters.customer || normalizeText(lead.clientName) === normalizeText(filters.customer);
    const campaignMatch = !filters.campaign || normalizeText(tags.campaign) === normalizeText(filters.campaign);
    const productMatch = !filters.product || normalizeText(tags.product || lead.title) === normalizeText(filters.product);
    const statusMatch =
      !filters.status || normalizeText(lead.stageLabel || lead.stageKey) === normalizeText(filters.status);
    return salespersonMatch && customerMatch && campaignMatch && productMatch && statusMatch;
  });

  const filteredQuotations = quotations.filter((quotation) => {
    const salespersonMatch = !filters.salesperson || quotation.createdById === filters.salesperson;
    const customerMatch = !filters.customer || normalizeText(quotation.clientName) === normalizeText(filters.customer);
    const productName = quotation.serviceName || quotation.projectTitle;
    const productMatch = !filters.product || normalizeText(productName) === normalizeText(filters.product);
    const statusMatch = !filters.status || normalizeText(quotation.status) === normalizeText(filters.status);
    return salespersonMatch && customerMatch && productMatch && statusMatch;
  });

  const filteredInvoices = scopedInvoices.filter((invoice) => {
    const invoiceStatus = deriveInvoiceStatus(invoice);
    const salespersonMatch = !filters.salesperson || invoice.salespersonId === filters.salesperson;
    const customerMatch = !filters.customer || normalizeText(invoice.clientName) === normalizeText(filters.customer);
    const productName = invoice.serviceName || invoice.projectTitle;
    const productMatch = !filters.product || normalizeText(productName) === normalizeText(filters.product);
    const statusMatch =
      !filters.status ||
      normalizeText(invoiceStatus) === normalizeText(filters.status) ||
      normalizeText(invoice.quotationStatus) === normalizeText(filters.status);
    return salespersonMatch && customerMatch && productMatch && statusMatch;
  });

  const totalLeads = filteredLeads.length;
  const qualifiedLeads = filteredLeads.filter((lead) => matchStageLabel(lead.stageLabel || lead.stageKey, "qualified")).length;
  const wonDeals = filteredLeads.filter((lead) => matchStageLabel(lead.stageLabel || lead.stageKey, "won")).length;
  const lostDeals = filteredLeads.filter((lead) => matchStageLabel(lead.stageLabel || lead.stageKey, "lost")).length;
  const crmConversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;

  const confirmedStatuses = new Set(["confirmed", "sales_order", "ordered"]);
  const rejectedStatuses = new Set(["cancelled", "rejected", "lost"]);
  const totalQuotations = filteredQuotations.length;
  const draftQuotations = filteredQuotations.filter((quotation) => normalizeText(quotation.status) === "draft").length;
  const sentQuotations = filteredQuotations.filter((quotation) => normalizeText(quotation.status) === "sent").length;
  const confirmedQuotations = filteredQuotations.filter((quotation) => confirmedStatuses.has(normalizeText(quotation.status))).length;
  const rejectedQuotations = filteredQuotations.filter((quotation) => rejectedStatuses.has(normalizeText(quotation.status))).length;
  const averageQuotationValue =
    totalQuotations > 0
      ? filteredQuotations.reduce((sum, quotation) => sum + quotation.totalAmount, 0) / totalQuotations
      : 0;

  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter((invoice) => deriveInvoiceStatus(invoice) === "PAID");
  const unpaidInvoices = filteredInvoices.filter((invoice) => deriveInvoiceStatus(invoice) === "UNPAID");
  const overdueInvoices = filteredInvoices.filter((invoice) => deriveInvoiceStatus(invoice) === "OVERDUE");
  const totalRevenue = filteredInvoices.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  const overallConversionRate = totalLeads > 0 ? (confirmedQuotations / totalLeads) * 100 : 0;

  const monthHref = () => {
    return buildReportingHref({ section: "invoices", status: "" });
  };

  const monthlySales = Object.values(
    filteredInvoices.reduce<Record<string, { label: string; value: number }>>((acc, invoice) => {
      const key = monthKey(invoice.invoiceCreatedAt);
      if (!acc[key]) acc[key] = { label: labelizeMonth(invoice.invoiceCreatedAt), value: 0 };
      acc[key].value += invoice.paidAmount;
      return acc;
    }, {}),
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-6)
    .map((item) => ({ ...item, href: monthHref() }));

  const leadsByStage = Object.entries(
    filteredLeads.reduce<Record<string, number>>((acc, lead) => {
      const key = lead.stageLabel || lead.stageKey || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value,
      href: buildReportingHref({ section: "crm", status: label }),
    }))
    .sort((a, b) => b.value - a.value);

  const quotationsByStatus = Object.entries(
    filteredQuotations.reduce<Record<string, number>>((acc, quotation) => {
      acc[quotation.status] = (acc[quotation.status] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value,
      href: buildReportingHref({ section: "quotations", status: label }),
    }))
    .sort((a, b) => b.value - a.value);

  const topCustomers = Object.entries(
    filteredInvoices.reduce<Record<string, { value: number; count: number }>>((acc, invoice) => {
      if (!acc[invoice.clientName]) acc[invoice.clientName] = { value: 0, count: 0 };
      acc[invoice.clientName].value += invoice.paidAmount;
      acc[invoice.clientName].count += 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value: value.value,
      secondary: `${value.count} invoice(s)`,
      href: buildReportingHref({ section: "invoices", customer: label }),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const leadsBySource = Object.entries(
    filteredLeads.reduce<Record<string, number>>((acc, lead) => {
      const source = parseTagMap(lead.tags).source || "Direct";
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value,
      href: buildReportingHref({ section: "crm" }),
    }))
    .sort((a, b) => b.value - a.value);

  const leadsBySalesperson = Object.entries(
    filteredLeads.reduce<Record<string, { value: number; id: string }>>((acc, lead) => {
      const label = lead.salespersonName || "Unassigned";
      if (!acc[label]) acc[label] = { value: 0, id: lead.createdById };
      acc[label].value += 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value: value.value,
      href: buildReportingHref({ section: "crm", salesperson: value.id }),
    }))
    .sort((a, b) => b.value - a.value);

  const monthlyLeadTrend = Object.values(
    filteredLeads.reduce<Record<string, { label: string; value: number }>>((acc, lead) => {
      const key = monthKey(lead.createdAt);
      if (!acc[key]) acc[key] = { label: labelizeMonth(lead.createdAt), value: 0 };
      acc[key].value += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-6)
    .map((item) => ({ ...item, href: buildReportingHref({ section: "crm" }) }));

  const quotationByMonth = Object.values(
    filteredQuotations.reduce<Record<string, { label: string; value: number }>>((acc, quotation) => {
      const key = monthKey(quotation.createdAt);
      if (!acc[key]) acc[key] = { label: labelizeMonth(quotation.createdAt), value: 0 };
      acc[key].value += quotation.totalAmount;
      return acc;
    }, {}),
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-6)
    .map((item) => ({ ...item, href: buildReportingHref({ section: "quotations" }) }));

  const quotationBySalesperson = Object.entries(
    filteredQuotations.reduce<Record<string, { value: number; id: string }>>((acc, quotation) => {
      const label = quotation.salespersonName || "Unassigned";
      if (!acc[label]) acc[label] = { value: 0, id: quotation.createdById };
      acc[label].value += quotation.totalAmount;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value: value.value,
      href: buildReportingHref({ section: "quotations", salesperson: value.id }),
    }))
    .sort((a, b) => b.value - a.value);

  const quotationByCustomer = Object.entries(
    filteredQuotations.reduce<Record<string, number>>((acc, quotation) => {
      acc[quotation.clientName] = (acc[quotation.clientName] || 0) + quotation.totalAmount;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({
      label,
      value,
      href: buildReportingHref({ section: "quotations", customer: label }),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const revenueByMonth = Object.values(
    filteredInvoices.reduce<Record<string, { label: string; value: number }>>((acc, invoice) => {
      const key = monthKey(invoice.invoiceCreatedAt);
      if (!acc[key]) acc[key] = { label: labelizeMonth(invoice.invoiceCreatedAt), value: 0 };
      acc[key].value += invoice.paidAmount;
      return acc;
    }, {}),
  )
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-6)
    .map((item) => ({ ...item, href: buildReportingHref({ section: "invoices" }) }));

  const paidVsUnpaid = [
    {
      label: "Paid",
      value: paidInvoices.length,
      href: buildReportingHref({ section: "invoices", status: "PAID" }),
    },
    {
      label: "Unpaid",
      value: unpaidInvoices.length,
      href: buildReportingHref({ section: "invoices", status: "UNPAID" }),
    },
    {
      label: "Overdue",
      value: overdueInvoices.length,
      href: buildReportingHref({ section: "invoices", status: "OVERDUE" }),
    },
  ];

  return {
    filters,
    options: {
      salespeople: Array.from(salespeopleMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      customers,
      statuses,
      products,
      campaigns,
      companies: ["Main Company"],
    },
    overview: {
      totalLeads,
      totalQuotations,
      totalConfirmedOrders: confirmedQuotations,
      totalRevenue,
      conversionRate: overallConversionRate,
      monthlySales,
      quotationsByStatus,
      leadsByStage,
      topCustomers,
    },
    crm: {
      totalLeads,
      qualifiedLeads,
      wonDeals,
      lostDeals,
      conversionRate: crmConversionRate,
      leadsByStage,
      leadsBySource,
      leadsBySalesperson,
      monthlyLeadTrend,
      detailRows: filteredLeads.map((lead) => {
        const tags = parseTagMap(lead.tags);
        return {
          id: lead.id,
          title: lead.title,
          customer: lead.clientName || "-",
          stage: lead.stageLabel || lead.stageKey,
          salesperson: lead.salespersonName || "Unassigned",
          campaign: tags.campaign || "-",
          source: tags.source || "Direct",
          value: Number(lead.value || 0),
          createdAt: lead.createdAt,
          href: "/crm",
        };
      }),
    },
    quotations: {
      total: totalQuotations,
      draft: draftQuotations,
      sent: sentQuotations,
      confirmed: confirmedQuotations,
      rejected: rejectedQuotations,
      averageValue: averageQuotationValue,
      byMonth: quotationByMonth,
      bySalesperson: quotationBySalesperson,
      byCustomer: quotationByCustomer,
      detailRows: filteredQuotations.map((quotation) => ({
        id: quotation.id,
        quotationNo: quotation.quotationNo,
        title: quotation.title,
        customer: quotation.clientName,
        salesperson: quotation.salespersonName || "Unassigned",
        status: quotation.status,
        amount: quotation.totalAmount,
        createdAt: quotation.createdAt,
        href: `/crm/${quotation.crmLeadId}/quotations/${quotation.id}`,
      })),
    },
    invoices: {
      total: totalInvoices,
      paid: paidInvoices.length,
      unpaid: unpaidInvoices.length,
      overdue: overdueInvoices.length,
      totalRevenue,
      revenueByMonth,
      paidVsUnpaid,
      topCustomers,
      detailRows: filteredInvoices.map((invoice) => ({
        id: invoice.invoiceId,
        invoiceRef: `INV/${invoice.invoiceCreatedAt.getFullYear()}/${invoice.quotationNo.replace(/^Q-/, "")}`,
        customer: invoice.clientName,
        salesperson: invoice.salespersonName || "Unassigned",
        status: deriveInvoiceStatus(invoice),
        paidAmount: invoice.paidAmount,
        balanceAmount: invoice.balanceAmount,
        totalAmount: invoice.invoiceTotal,
        createdAt: invoice.invoiceCreatedAt,
        href: `/crm/${invoice.crmLeadId}/quotations/${invoice.quotationId}/invoice`,
      })),
    },
  };
}
