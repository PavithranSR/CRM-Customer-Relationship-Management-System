import { db } from "@/lib/db";
import type { ProjectClientOption, ProjectClientRecord } from "./project-client-types";

type QuotationClientOptionSource = {
  id: string;
  clientName: string;
  clientEmail: string;
  serviceName: string | null;
  projectTitle: string;
  quotationNo: string;
  title: string;
  status: string;
};

function normalizeLookupValue(value?: string | null) {
  return value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") ?? "";
}

function trimValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isOpportunityLikeValue(value?: string | null) {
  return /\bopportunity\b/i.test(value ?? "");
}

function getPreferredProjectName(options: {
  projectName?: string | null;
  serviceName?: string | null;
  quotationProjectTitle?: string | null;
  opportunityTitle?: string | null;
}) {
  const candidates = [
    trimValue(options.projectName),
    trimValue(options.serviceName),
    trimValue(options.quotationProjectTitle),
    trimValue(options.opportunityTitle),
  ].filter((value): value is string => Boolean(value));

  return candidates.find((value) => !isOpportunityLikeValue(value)) ?? candidates[0] ?? null;
}

function buildClientIdentity(options: {
  linkedClientId?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
}) {
  if (options.linkedClientId) {
    return `client:${options.linkedClientId}`;
  }

  const normalizedEmail = normalizeLookupValue(options.clientEmail);
  if (normalizedEmail) {
    return `email:${normalizedEmail}`;
  }

  const normalizedName = normalizeLookupValue(options.clientName);
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return "unknown";
}

function getProjectNameCandidates(quotation: QuotationClientOptionSource) {
  return Array.from(
    new Set(
      [quotation.projectTitle, quotation.serviceName, quotation.title]
        .map((value) => normalizeLookupValue(value))
        .filter(Boolean)
    )
  );
}

export async function getAvailableProjectClientOptions(
  quotationOptions: QuotationClientOptionSource[]
): Promise<ProjectClientOption[]> {
  if (quotationOptions.length === 0) {
    return [];
  }

  const [clients, existingProjects] = await Promise.all([
    db.client.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        collegeName: true,
        email: true,
        phone: true,
        street: true,
        address: true,
        city: true,
        zip: true,
        state: true,
        country: true,
        serviceName: true,
        projectName: true,
        tags: true,
        notes: true,
        isActive: true,
      },
    }),
    db.project.findMany({
      select: {
        id: true,
        name: true,
        clientId: true,
        client: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const clientsByEmail = new Map<string, ProjectClientRecord>();
  const clientsByName = new Map<string, ProjectClientRecord>();

  for (const client of clients) {
    const normalizedEmail = normalizeLookupValue(client.email);
    if (normalizedEmail && !clientsByEmail.has(normalizedEmail)) {
      clientsByEmail.set(normalizedEmail, client);
    }

    const normalizedName = normalizeLookupValue(client.name);
    if (normalizedName && !clientsByName.has(normalizedName)) {
      clientsByName.set(normalizedName, client);
    }
  }

  const existingProjectKeys = new Set<string>();

  for (const project of existingProjects) {
    const normalizedProjectName = normalizeLookupValue(project.name);
    if (!normalizedProjectName) {
      continue;
    }

    const identity = buildClientIdentity({
      linkedClientId: project.clientId,
      clientName: project.client?.name,
      clientEmail: project.client?.email,
    });

    existingProjectKeys.add(`${identity}::${normalizedProjectName}`);

    if (!project.clientId) {
      existingProjectKeys.add(`no-client::${normalizedProjectName}`);
    }
  }

  const seenOptionKeys = new Set<string>();
  const seenQuotationIds = new Set<string>();
  const availableOptions: ProjectClientOption[] = [];

  for (const quotation of quotationOptions) {
    if (seenQuotationIds.has(quotation.id)) {
      continue;
    }
    seenQuotationIds.add(quotation.id);

    const linkedClient =
      clientsByEmail.get(normalizeLookupValue(quotation.clientEmail)) ??
      clientsByName.get(normalizeLookupValue(quotation.clientName)) ??
      null;
    const linkedClientId = linkedClient?.id ?? null;

    const identity = buildClientIdentity({
      linkedClientId,
      clientName: quotation.clientName,
      clientEmail: quotation.clientEmail,
    });

    const projectNameCandidates = getProjectNameCandidates(quotation);
    const alreadyCreated = projectNameCandidates.some((projectName) => {
      return (
        existingProjectKeys.has(`${identity}::${projectName}`) ||
        (!linkedClientId && existingProjectKeys.has(`no-client::${projectName}`))
      );
    });

    if (alreadyCreated) {
      continue;
    }

    const primaryProjectName = getPreferredProjectName({
      projectName: linkedClient?.projectName,
      serviceName: linkedClient?.serviceName ?? quotation.serviceName,
      quotationProjectTitle: quotation.projectTitle,
      opportunityTitle: quotation.title,
    });
    const dedupeKey = `${quotation.id}::${identity}::${normalizeLookupValue(primaryProjectName || quotation.quotationNo)}`;

    if (seenOptionKeys.has(dedupeKey)) {
      continue;
    }

    seenOptionKeys.add(dedupeKey);
    availableOptions.push({
      id: quotation.id,
      linkedClientId,
      name: linkedClient?.name ?? quotation.clientName,
      collegeName: linkedClient?.collegeName ?? null,
      email: linkedClient?.email ?? quotation.clientEmail,
      phone: linkedClient?.phone ?? null,
      street: linkedClient?.street ?? null,
      address: linkedClient?.address ?? null,
      city: linkedClient?.city ?? null,
      zip: linkedClient?.zip ?? null,
      state: linkedClient?.state ?? null,
      country: linkedClient?.country ?? null,
      serviceName: linkedClient?.serviceName ?? quotation.serviceName,
      projectName: linkedClient?.projectName ?? primaryProjectName,
      quotationNo: quotation.quotationNo,
      sourceTitle: quotation.title,
      tags: linkedClient?.tags ?? quotation.status,
      notes: linkedClient?.notes ?? null,
      isActive: linkedClient?.isActive ?? true,
    });
  }

  return availableOptions.sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    if (nameOrder !== 0) {
      return nameOrder;
    }

    const projectOrder = (left.projectName || "").localeCompare(right.projectName || "");
    if (projectOrder !== 0) {
      return projectOrder;
    }

    return (left.quotationNo || "").localeCompare(right.quotationNo || "");
  });
}
