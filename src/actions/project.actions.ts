"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAdmin,
  requireModuleAccess,
  requireProjectRecordAccess,
} from "@/lib/auth";
import {
  createProjectSchema,
  updateProjectSchema,
  holdProjectSchema,
} from "@/lib/validations/project.schema";
import {
  buildProjectWhereForViewer,
  normalizeEmployeePermissions,
  sanitizeListByFieldPermissions,
  sanitizeRecordByFieldPermissions,
  type EmployeePermissions,
} from "@/lib/employee-permissions";
import { ensureTimeEntrySchemaReady } from "@/lib/time-entry-schema.server";
import { logActivity } from "./activity-log.actions";
import { Prisma, ProjectStatus } from "@prisma/client";

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P1001"
  );
}

function isProjectAccessError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === "Unauthorized" || error.message.startsWith("Forbidden"))
  );
}

async function ensureDefaultProjectStages() {
  const count = await db.projectStage.count();
  if (count > 0) return;

  await db.projectStage.createMany({
    data: [
      { name: "Planning", sortOrder: 0 },
      { name: "In Progress", sortOrder: 1 },
      { name: "On Hold", sortOrder: 2 },
      { name: "Completed", sortOrder: 3 },
      { name: "Cancelled", sortOrder: 4 },
    ],
  });
}

export async function getProjectStages() {
  await ensureDefaultProjectStages();

  return db.projectStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

async function getStageIdForStatus(status: ProjectStatus) {
  const stageNameByStatus: Record<ProjectStatus, string> = {
    PLANNING: "Planning",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };

  const stage = await db.projectStage.findFirst({
    where: { name: { equals: stageNameByStatus[status], mode: "insensitive" } },
    select: { id: true },
  });

  return stage?.id;
}

async function generateProjectCode() {
  const latestProject = await db.project.findFirst({
    where: { code: { startsWith: "PRJ-" } },
    orderBy: [{ createdAt: "desc" }],
    select: { code: true },
  });

  const latestNumber = latestProject?.code.match(/^PRJ-(\d+)$/)?.[1];
  const startNumber = latestNumber ? Number(latestNumber) + 1 : 1;

  for (let offset = 0; offset < 1000; offset += 1) {
    const candidate = `PRJ-${String(startNumber + offset).padStart(3, "0")}`;
    const exists = await db.project.findUnique({
      where: { code: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }

  return `PRJ-${Date.now()}`;
}

async function resolveProjectClientId(rawClientId?: string) {
  const normalizedClientId = rawClientId?.trim();
  if (!normalizedClientId || normalizedClientId === "none") {
    return undefined;
  }

  const directClient = await db.client.findUnique({
    where: { id: normalizedClientId },
    select: { id: true },
  });
  if (directClient) {
    return directClient.id;
  }

  const quotation = await db.crmQuotation.findUnique({
    where: { id: normalizedClientId },
    select: {
      clientEmail: true,
      clientName: true,
    },
  });
  if (!quotation) {
    return undefined;
  }

  const email = quotation.clientEmail.trim();
  const name = quotation.clientName.trim();
  if (!email && !name) {
    return undefined;
  }

  const matchedClient = await db.client.findFirst({
    where: {
      OR: [
        ...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
        ...(name ? [{ name: { equals: name, mode: "insensitive" as const } }] : []),
      ],
    },
    select: { id: true },
  });

  return matchedClient?.id;
}

async function resolveProjectLead(rawLeadId?: string) {
  const normalizedLeadId = rawLeadId?.trim();
  if (!normalizedLeadId) {
    return { lead: null as null, error: undefined as string | undefined };
  }

  const lead = await db.user.findUnique({
    where: { id: normalizedLeadId },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      permissions: true,
    },
  });

  if (!lead || !lead.isActive || (lead.role !== "BA" && lead.role !== "TEAMLEADER")) {
    return { lead: null, error: "Project lead must be an active BA or team leader" };
  }

  const hasProjectModuleAccess = normalizeEmployeePermissions(
    lead.permissions
  ).moduleAccess.includes("PROJECT");

  if (!hasProjectModuleAccess) {
    return { lead: null, error: "Selected project lead does not have Projects module access" };
  }

  return { lead, error: undefined as string | undefined };
}

function getLeadRequiresClientError(managerId?: string, clientId?: string) {
  const normalizedManagerId = managerId?.trim();
  if (!normalizedManagerId) {
    return undefined;
  }

  const normalizedClientId = clientId?.trim();
  if (normalizedClientId) {
    return undefined;
  }

  return "Create or select a client before assigning a project lead";
}

function normalizeProjectName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeProjectNameForComparison(value: string) {
  return normalizeProjectName(value).toLocaleLowerCase();
}

async function findProjectNameConflict(options: {
  name: string;
  clientId: string | null;
  excludeProjectId?: string;
}) {
  const normalizedName = normalizeProjectNameForComparison(options.name);
  if (!normalizedName) {
    return null;
  }

  const projects = await db.project.findMany({
    where: {
      clientId: options.clientId,
      ...(options.excludeProjectId ? { NOT: { id: options.excludeProjectId } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return (
    projects.find(
      (project) => normalizeProjectNameForComparison(project.name) === normalizedName
    ) ?? null
  );
}

function getDuplicateProjectError(clientId: string | null) {
  if (clientId) {
    return "This client already has a project with the same name";
  }

  return "A project with the same name already exists";
}

const PROJECT_IMPORT_FIELD_ALIASES = {
  name: ["name", "project_name", "project_title", "title", "project"],
  description: ["description", "notes", "project_description"],
  clientId: ["client_id", "customer_id"],
  clientName: ["client_name", "customer_name", "customer", "client"],
  clientEmail: ["client_email", "customer_email", "email"],
  clientPhone: ["client_phone", "customer_phone", "phone"],
  clientCountry: ["client_country", "customer_country", "country"],
  serviceName: ["service_name", "service", "category"],
  projectName: ["project_name", "project_title", "name"],
  unitName: ["unit_name"],
  unitCount: ["unit_count", "quantity", "qty"],
  unitPrice: ["unit_price", "price", "amount"],
  costPerUnit: ["cost_per_unit", "cost"],
  subtotalAmount: ["subtotal_amount", "subtotal"],
  gstPercent: ["gst_percent", "tax_percent", "gst"],
  gstAmount: ["gst_amount", "tax_amount"],
  finalAmount: ["final_amount", "total_amount", "total"],
  profitAmount: ["profit_amount", "profit"],
  invoicingPolicy: ["invoicing_policy", "billing_type", "billing_policy"],
  tags: ["tags", "tag"],
  expectedClosingDate: ["expected_closing_date", "closing_date"],
  priority: ["priority"],
  estimatedHours: ["estimated_hours", "planned_hours"],
  startDate: ["start_date"],
  deadline: ["deadline", "end_date", "due_date"],
  status: ["status", "project_status"],
  stage: ["stage", "project_stage"],
  leadId: ["lead_id", "manager_id", "project_lead_id", "assigned_leader_id"],
  leadEmail: [
    "lead_email",
    "manager_email",
    "project_lead_email",
    "assigned_leader_email",
    "leader_email",
  ],
  leadName: [
    "lead_name",
    "manager_name",
    "project_lead_name",
    "assigned_leader",
    "assigned_leader_name",
    "leader_name",
  ],
} as const;

function normalizeImportFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createNormalizedImportRow(values: Record<string, string>) {
  return new Map(
    Object.entries(values).map(([key, value]) => [
      normalizeImportFieldKey(key),
      typeof value === "string" ? value.trim() : "",
    ])
  );
}

function getImportField(
  row: Map<string, string>,
  aliases: readonly string[]
) {
  for (const alias of aliases) {
    const value = row.get(alias);
    if (value) {
      return value;
    }
  }

  return "";
}

function mapImportPriority(value: string) {
  const normalized = normalizeImportFieldKey(value);

  switch (normalized) {
    case "low":
      return "LOW" as const;
    case "medium":
    case "normal":
      return "MEDIUM" as const;
    case "high":
    case "urgent":
      return "HIGH" as const;
    default:
      return undefined;
  }
}

function mapImportStatus(value: string) {
  const normalized = normalizeImportFieldKey(value);

  switch (normalized) {
    case "planning":
    case "new":
      return "PLANNING" as const;
    case "in_progress":
    case "inprogress":
    case "active":
    case "progress":
      return "IN_PROGRESS" as const;
    case "on_hold":
    case "hold":
    case "paused":
      return "ON_HOLD" as const;
    case "completed":
    case "complete":
    case "done":
    case "closed":
      return "COMPLETED" as const;
    case "cancelled":
    case "canceled":
      return "CANCELLED" as const;
    default:
      return undefined;
  }
}

function canUseLeadAsProjectManager(lead: {
  role: string;
  isActive: boolean;
  permissions: Prisma.JsonValue | null;
}) {
  if (!lead.isActive || (lead.role !== "BA" && lead.role !== "TEAMLEADER")) {
    return false;
  }

  return normalizeEmployeePermissions(lead.permissions).moduleAccess.includes("PROJECT");
}

async function resolveImportLeadId(row: Map<string, string>) {
  const leadId = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.leadId);
  const leadEmail = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.leadEmail);
  const leadName = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.leadName);

  if (!leadId && !leadEmail && !leadName) {
    return { leadId: undefined as string | undefined, error: undefined as string | undefined };
  }

  if (leadId) {
    const resolvedLead = await resolveProjectLead(leadId);
    return resolvedLead.error
      ? { leadId: undefined, error: resolvedLead.error }
      : { leadId: resolvedLead.lead?.id, error: undefined };
  }

  if (leadEmail) {
    const lead = await db.user.findFirst({
      where: { email: { equals: leadEmail, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    });

    if (!lead) {
      return { leadId: undefined, error: `Project lead with email "${leadEmail}" was not found` };
    }

    if (!canUseLeadAsProjectManager(lead)) {
      return {
        leadId: undefined,
        error: `Project lead "${lead.name}" must be an active BA or team leader with Projects access`,
      };
    }

    return { leadId: lead.id, error: undefined };
  }

  const matchingLeads = await db.user.findMany({
    where: { name: { equals: leadName, mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      permissions: true,
    },
  });

  const validLeads = matchingLeads.filter((lead) => canUseLeadAsProjectManager(lead));
  if (validLeads.length === 1) {
    return { leadId: validLeads[0].id, error: undefined };
  }

  if (validLeads.length > 1) {
    return {
      leadId: undefined,
      error: `Multiple project leads matched "${leadName}". Use the lead email instead.`,
    };
  }

  if (matchingLeads.length > 0) {
    return {
      leadId: undefined,
      error: `Project lead "${leadName}" must be an active BA or team leader with Projects access`,
    };
  }

  return { leadId: undefined, error: `Project lead "${leadName}" was not found` };
}

async function resolveImportClientId(row: Map<string, string>) {
  const clientId = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientId);
  if (clientId) {
    const resolvedClientId = await resolveProjectClientId(clientId);
    if (resolvedClientId) {
      return resolvedClientId;
    }
  }

  const clientEmail = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientEmail);
  if (clientEmail) {
    const existingClient = await db.client.findFirst({
      where: { email: { equals: clientEmail, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingClient) {
      return existingClient.id;
    }

    const clientName =
      getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientName) ||
      clientEmail.split("@")[0] ||
      "Client";

    try {
      const createdClient = await db.client.create({
        data: {
          name: clientName,
          email: clientEmail,
          phone: getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientPhone) || null,
          country: getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientCountry) || null,
          serviceName: getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.serviceName) || null,
          projectName: getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.projectName) || null,
          tags: getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.tags) || null,
        },
        select: { id: true },
      });

      return createdClient.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const duplicateClient = await db.client.findFirst({
          where: { email: { equals: clientEmail, mode: "insensitive" } },
          select: { id: true },
        });

        return duplicateClient?.id;
      }

      throw error;
    }
  }

  const clientName = getImportField(row, PROJECT_IMPORT_FIELD_ALIASES.clientName);
  if (!clientName) {
    return undefined;
  }

  const existingClient = await db.client.findFirst({
    where: { name: { equals: clientName, mode: "insensitive" } },
    select: { id: true },
  });

  return existingClient?.id;
}

type ImportProjectRecordInput = {
  rowNumber: number;
  values: Record<string, string>;
};

type ImportProjectRecordResult = {
  rowNumber: number;
  projectName: string;
  success: boolean;
  message: string;
};

async function ensureProjectLeadAssignment(input: {
  projectId: string;
  lead: { id: string; role: string } | null;
}) {
  if (!input.lead || input.lead.role !== "TEAMLEADER") {
    return;
  }

  const existing = await db.projectAssignment.findUnique({
    where: {
      projectId_userId: {
        projectId: input.projectId,
        userId: input.lead.id,
      },
    },
    select: { id: true, isActive: true },
  });

  if (existing) {
    if (!existing.isActive) {
      await db.projectAssignment.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          role: "PROJECT_LEAD",
          assignedAt: new Date(),
          unassignedAt: null,
        },
      });
    }
    return;
  }

  await db.projectAssignment.create({
    data: {
      projectId: input.projectId,
      userId: input.lead.id,
      role: "PROJECT_LEAD",
    },
  });
}

type ProjectTemplateKey = "HARDWARE" | "SOFTWARE" | "INTERNSHIP";

const PROJECT_TEMPLATES: Record<
  ProjectTemplateKey,
  { name: string; amount: number; tags: string }
> = {
  HARDWARE: { name: "Hardware Project", amount: 15000, tags: "hardware" },
  SOFTWARE: { name: "Software Project", amount: 10000, tags: "software" },
  INTERNSHIP: { name: "Internship Project", amount: 5000, tags: "internship" },
};

const round2 = (value: number) => Math.round(value * 100) / 100;

async function getNextProjectCode(prefix = "PRJ") {
  const rows = await db.$queryRaw<Array<{ maxNo: number | null }>>`
    SELECT MAX(
      NULLIF(regexp_replace("code", '[^0-9]', '', 'g'), '')::int
    ) AS "maxNo"
    FROM "projects"
  `;
  const nextNo = (rows[0]?.maxNo ?? 0) + 1;
  return `${prefix}-${String(nextNo).padStart(4, "0")}`;
}

export async function getProjects(userId?: string, role?: string, permissions?: EmployeePermissions) {
  const where = userId && role
    ? buildProjectWhereForViewer({ userId, role, permissions })
    : {};

  const projects = await db.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          teamId: true,
          department: true,
          position: true,
          phone: true,
          isActive: true,
          hireDate: true,
        },
      },
      client: {
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
      },
      stage: { select: { id: true, name: true, sortOrder: true } },
      assignments: {
        where: { isActive: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              teamId: true,
              department: true,
              position: true,
              phone: true,
              isActive: true,
              hireDate: true,
            },
          },
        },
      },
      _count: {
        select: { timeEntries: true },
      },
    },
  });

  const projectIds = projects.map((project) => project.id);
  const taskCountByProject = new Map<string, number>();

  if (projectIds.length > 0) {
    const taskStateLogs = await db.activityLog.findMany({
      where: {
        entityType: "project_task_state",
        projectId: { in: projectIds },
      },
      orderBy: { createdAt: "desc" },
      select: {
        projectId: true,
        metadata: true,
      },
    });

    for (const log of taskStateLogs) {
      if (!log.projectId || taskCountByProject.has(log.projectId)) {
        continue;
      }

      const metadata =
        log.metadata && typeof log.metadata === "object"
          ? (log.metadata as { tasks?: unknown[] })
          : null;
      const taskCount = Array.isArray(metadata?.tasks) ? metadata.tasks.length : 0;
      taskCountByProject.set(log.projectId, taskCount);
    }
  }

  const projectsWithTaskCount = projects.map((project) => ({
    ...project,
    taskCount: taskCountByProject.get(project.id) ?? 0,
  }));

  if (!role || role === "ADMIN" || !permissions) {
    return projectsWithTaskCount;
  }

  return sanitizeListByFieldPermissions(
    projectsWithTaskCount as unknown as Record<string, unknown>[],
    permissions
  ) as typeof projectsWithTaskCount;
}

export async function getProject(id: string) {
  try {
    const user = await requireModuleAccess("PROJECT");
    await requireProjectRecordAccess(id);
    await ensureTimeEntrySchemaReady();

    const project = await db.project.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true, email: true, teamId: true } },
        client: {
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
        },
        stage: { select: { id: true, name: true, sortOrder: true } },
        assignments: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                teamId: true,
                department: true,
                position: true,
                phone: true,
                hireDate: true,
                isActive: true,
              },
            },
          },
        },
        timeEntries: {
          orderBy: { date: "desc" },
          take: 10,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!project) {
      return null;
    }

    if (user.role === "ADMIN") {
      return project;
    }

    return sanitizeRecordByFieldPermissions(
      project as unknown as Record<string, unknown>,
      user.permissions
    ) as typeof project;
  } catch (error) {
    if (isDatabaseConnectionError(error) || isProjectAccessError(error)) {
      return null;
    }
    throw error;
  }
}

export async function createProject(formData: FormData) {
  const user = await requireAdmin();
  const rawClientId =
    typeof formData.get("clientId") === "string" ? String(formData.get("clientId")).trim() : "";

  const validatedFields = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    code: formData.get("code") || undefined,
    clientId: formData.get("clientId") && formData.get("clientId") !== "none" ? formData.get("clientId") : undefined,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    type: formData.get("type"),
    priority: formData.get("priority"),
    estimatedHours: formData.get("estimatedHours") || undefined,
    startDate: formData.get("startDate") || undefined,
    deadline: formData.get("deadline") || undefined,
    managerId: formData.get("managerId") && formData.get("managerId") !== "none" ? formData.get("managerId") : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const resolvedClientId = await resolveProjectClientId(validatedFields.data.clientId);
  const resolvedLead = await resolveProjectLead(validatedFields.data.managerId);
  if (resolvedLead.error) {
    return { error: resolvedLead.error };
  }

  const leadClientError = getLeadRequiresClientError(
    validatedFields.data.managerId,
    resolvedClientId
  );
  if (leadClientError) {
    return { error: leadClientError };
  }

  const normalizedProjectName = normalizeProjectName(validatedFields.data.name);
  const finalClientId = rawClientId && rawClientId !== "none" ? resolvedClientId ?? null : null;
  const duplicateProject = await findProjectNameConflict({
    name: normalizedProjectName,
    clientId: finalClientId,
  });

  if (duplicateProject) {
    return { error: getDuplicateProjectError(finalClientId) };
  }

  await ensureDefaultProjectStages();
  const firstStage = await db.projectStage.findFirst({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  let project = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const generatedCode = await generateProjectCode();

    try {
      project = await db.project.create({
        data: {
          ...validatedFields.data,
          name: normalizedProjectName,
          clientId: finalClientId,
          code: generatedCode,
          stageId: firstStage?.id,
        },
      });
      break;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  if (!project) {
    return { error: "Could not generate unique project code. Please try again." };
  }

  await ensureProjectLeadAssignment({
    projectId: project.id,
    lead: resolvedLead.lead,
  });

  await logActivity({
    action: "CREATE",
    entityType: "project",
    entityId: project.id,
    createdById: user.id,
    metadata: { name: project.name, code: project.code },
  });

  if (project.managerId) {
    await logActivity({
      action: "ASSIGN",
      entityType: "project_manager",
      entityId: project.id,
      userId: project.managerId,
      createdById: user.id,
      metadata: {
        projectName: project.name,
        managerName: resolvedLead.lead?.name ?? "Project lead",
        managerRole: resolvedLead.lead?.role ?? null,
      },
    });
  }

  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function importProjectsFromRecords(records: ImportProjectRecordInput[]) {
  await requireAdmin();

  if (!Array.isArray(records) || records.length === 0) {
    return { error: "Please upload a CSV file with at least one project row" };
  }

  if (records.length > 250) {
    return { error: "Please import 250 projects or fewer at a time" };
  }

  await ensureDefaultProjectStages();
  const availableStages = await db.projectStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });
  const stageMap = new Map(
    availableStages.map((stage) => [normalizeImportFieldKey(stage.name), stage.id])
  );

  const results: ImportProjectRecordResult[] = [];

  for (const record of records) {
    const normalizedRow = createNormalizedImportRow(record.values);
    const projectName = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.name);

    if (!projectName) {
      results.push({
        rowNumber: record.rowNumber,
        projectName: "",
        success: false,
        message: "Project name is required",
      });
      continue;
    }

    const resolvedLead = await resolveImportLeadId(normalizedRow);
    if (resolvedLead.error) {
      results.push({
        rowNumber: record.rowNumber,
        projectName,
        success: false,
        message: resolvedLead.error,
      });
      continue;
    }

    const resolvedClientId = await resolveImportClientId(normalizedRow);
    const leadClientError = getLeadRequiresClientError(resolvedLead.leadId, resolvedClientId);
    if (leadClientError) {
      results.push({
        rowNumber: record.rowNumber,
        projectName,
        success: false,
        message: leadClientError,
      });
      continue;
    }

    const importStatus = mapImportStatus(
      getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.status)
    );
    const importPriority =
      mapImportPriority(getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.priority)) ??
      "MEDIUM";
    const importStageId = stageMap.get(
      normalizeImportFieldKey(getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.stage))
    );

    const formData = new FormData();
    formData.set("name", projectName);
    formData.set("type", "TEAM");
    formData.set("priority", importPriority);

    const description = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.description);
    if (description) formData.set("description", description);

    const serviceName = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.serviceName);
    if (serviceName) formData.set("serviceName", serviceName);

    const unitName = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.unitName);
    if (unitName) formData.set("unitName", unitName);

    const unitCount = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.unitCount);
    if (unitCount) formData.set("unitCount", unitCount);

    const unitPrice = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.unitPrice);
    if (unitPrice) formData.set("unitPrice", unitPrice);

    const costPerUnit = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.costPerUnit);
    if (costPerUnit) formData.set("costPerUnit", costPerUnit);

    const subtotalAmount = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.subtotalAmount);
    if (subtotalAmount) formData.set("subtotalAmount", subtotalAmount);

    const gstPercent = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.gstPercent);
    if (gstPercent) formData.set("gstPercent", gstPercent);

    const gstAmount = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.gstAmount);
    if (gstAmount) formData.set("gstAmount", gstAmount);

    const finalAmount = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.finalAmount);
    if (finalAmount) formData.set("finalAmount", finalAmount);

    const profitAmount = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.profitAmount);
    if (profitAmount) formData.set("profitAmount", profitAmount);

    const invoicingPolicy = getImportField(
      normalizedRow,
      PROJECT_IMPORT_FIELD_ALIASES.invoicingPolicy
    );
    if (invoicingPolicy) formData.set("invoicingPolicy", invoicingPolicy);

    const tags = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.tags);
    if (tags) formData.set("tags", tags);

    const expectedClosingDate = getImportField(
      normalizedRow,
      PROJECT_IMPORT_FIELD_ALIASES.expectedClosingDate
    );
    if (expectedClosingDate) formData.set("expectedClosingDate", expectedClosingDate);

    const estimatedHours = getImportField(
      normalizedRow,
      PROJECT_IMPORT_FIELD_ALIASES.estimatedHours
    );
    if (estimatedHours) formData.set("estimatedHours", estimatedHours);

    const startDate = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.startDate);
    if (startDate) formData.set("startDate", startDate);

    const deadline = getImportField(normalizedRow, PROJECT_IMPORT_FIELD_ALIASES.deadline);
    if (deadline) formData.set("deadline", deadline);

    if (resolvedClientId) {
      formData.set("clientId", resolvedClientId);
    }

    if (resolvedLead.leadId) {
      formData.set("managerId", resolvedLead.leadId);
    }

    const createdProject = await createProject(formData);
    if (!createdProject.success || !createdProject.data) {
      const errorMessage =
        typeof createdProject.error === "string"
          ? createdProject.error
          : JSON.stringify(createdProject.error);

      results.push({
        rowNumber: record.rowNumber,
        projectName,
        success: false,
        message: errorMessage || "Unable to create project",
      });
      continue;
    }

    if (importStatus && importStatus !== "PLANNING") {
      const statusResult = await updateProjectStatus(createdProject.data.id, importStatus);
      if (statusResult.error) {
        results.push({
          rowNumber: record.rowNumber,
          projectName,
          success: false,
          message: typeof statusResult.error === "string" ? statusResult.error : "Status update failed",
        });
        continue;
      }
    } else if (importStageId) {
      const stageResult = await updateProjectStage(createdProject.data.id, importStageId);
      if (stageResult.error) {
        results.push({
          rowNumber: record.rowNumber,
          projectName,
          success: false,
          message: typeof stageResult.error === "string" ? stageResult.error : "Stage update failed",
        });
        continue;
      }
    }

    results.push({
      rowNumber: record.rowNumber,
      projectName,
      success: true,
      message: resolvedLead.leadId ? "Project and lead imported successfully" : "Project imported successfully",
    });
  }

  revalidatePath("/projects");

  const createdCount = results.filter((result) => result.success).length;
  const failedCount = results.length - createdCount;

  return {
    success: failedCount === 0,
    createdCount,
    failedCount,
    results,
  };
}

export async function createProjectFromTemplate(templateKey: ProjectTemplateKey) {
  const user = await requireAdmin();
  const template = PROJECT_TEMPLATES[templateKey];
  if (!template) {
    return { error: "Invalid template" };
  }

  const code = await getNextProjectCode();
  const subtotalAmount = round2(template.amount);
  const gstPercent = 18;
  const gstAmount = round2(subtotalAmount * (gstPercent / 100));
  const finalAmount = round2(subtotalAmount + gstAmount);

  const project = await db.project.create({
    data: {
      name: template.name,
      code,
      serviceName: template.name,
      unitName: "Project",
      unitCount: 1,
      unitPrice: subtotalAmount,
      costPerUnit: 0,
      subtotalAmount,
      gstPercent,
      gstAmount,
      finalAmount,
      profitAmount: subtotalAmount,
      invoicingPolicy: "fixed_price",
      tags: template.tags,
      type: "INDIVIDUAL",
      priority: "MEDIUM",
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "project",
    entityId: project.id,
    createdById: user.id,
    metadata: { template: templateKey, name: project.name, code: project.code },
  });

  revalidatePath("/projects");
  return { success: true, data: project };
}

export async function updateProject(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);
  const rawClientId =
    typeof formData.get("clientId") === "string" ? String(formData.get("clientId")).trim() : undefined;
  const rawManagerId =
    typeof formData.get("managerId") === "string" ? String(formData.get("managerId")).trim() : undefined;
  const existingProject = await db.project.findUnique({
    where: { id },
    select: { id: true, managerId: true, name: true, clientId: true },
  });

  if (!existingProject) {
    return { error: "Project not found" };
  }

  const validatedFields = updateProjectSchema.safeParse({
    name: formData.get("name") || undefined,
    description: formData.get("description") || undefined,
    clientId: formData.get("clientId") && formData.get("clientId") !== "none" ? formData.get("clientId") : undefined,
    serviceName: formData.get("serviceName") || undefined,
    unitName: formData.get("unitName") || undefined,
    unitCount: formData.get("unitCount") || undefined,
    unitPrice: formData.get("unitPrice") || undefined,
    costPerUnit: formData.get("costPerUnit") || undefined,
    subtotalAmount: formData.get("subtotalAmount") || undefined,
    gstPercent: formData.get("gstPercent") || undefined,
    gstAmount: formData.get("gstAmount") || undefined,
    finalAmount: formData.get("finalAmount") || undefined,
    profitAmount: formData.get("profitAmount") || undefined,
    invoicingPolicy: formData.get("invoicingPolicy") || undefined,
    tags: formData.get("tags") || undefined,
    expectedClosingDate: formData.get("expectedClosingDate") || undefined,
    type: formData.get("type") || undefined,
    status: formData.get("status") || undefined,
    priority: formData.get("priority") || undefined,
    progress: formData.get("progress") ? Number(formData.get("progress")) : undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    startDate: formData.get("startDate") || undefined,
    deadline:
      formData.get("deadline") === ""
        ? null
        : formData.get("deadline") || undefined,
    managerId: formData.get("managerId") && formData.get("managerId") !== "none" ? formData.get("managerId") : undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const resolvedClientId = await resolveProjectClientId(validatedFields.data.clientId);
  const resolvedLead = await resolveProjectLead(validatedFields.data.managerId);
  if (resolvedLead.error) {
    return { error: resolvedLead.error };
  }

  const leadClientError = getLeadRequiresClientError(
    validatedFields.data.managerId,
    resolvedClientId
  );
  if (leadClientError) {
    return { error: leadClientError };
  }

  const normalizedProjectName =
    validatedFields.data.name === undefined
      ? existingProject.name
      : normalizeProjectName(validatedFields.data.name);
  const nextClientId =
    rawClientId === undefined
      ? existingProject.clientId ?? null
      : rawClientId === "" || rawClientId === "none"
        ? null
        : resolvedClientId ?? null;

  if (validatedFields.data.name !== undefined || rawClientId !== undefined) {
    const duplicateProject = await findProjectNameConflict({
      name: normalizedProjectName,
      clientId: nextClientId,
      excludeProjectId: id,
    });

    if (duplicateProject) {
      return { error: getDuplicateProjectError(nextClientId) };
    }
  }

  const project = await db.project.update({
    where: { id },
    data: {
      ...validatedFields.data,
      name:
        validatedFields.data.name === undefined
          ? undefined
          : normalizedProjectName,
      clientId:
        rawClientId === undefined
          ? undefined
          : rawClientId === "" || rawClientId === "none"
            ? null
            : resolvedClientId ?? null,
      managerId:
        rawManagerId === undefined
          ? undefined
          : rawManagerId === "" || rawManagerId === "none"
            ? null
            : validatedFields.data.managerId,
    },
  });

  await ensureProjectLeadAssignment({
    projectId: project.id,
    lead: resolvedLead.lead,
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: {
      changes: Object.keys(validatedFields.data),
      previousManagerId: existingProject.managerId,
      nextManagerId: project.managerId,
    },
  });

  if (existingProject.managerId !== project.managerId && project.managerId) {
    await logActivity({
      action: "ASSIGN",
      entityType: "project_manager",
      entityId: id,
      userId: project.managerId,
      createdById: user.id,
      metadata: {
        projectName: project.name,
        managerName: resolvedLead.lead?.name ?? "Project lead",
        managerRole: resolvedLead.lead?.role ?? null,
        previousManagerId: existingProject.managerId,
      },
    });
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: project };
}

export async function deleteProject(id: string) {
  const user = await requireActionPermission("DELETE", "PROJECT");

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }
  await requireProjectRecordAccess(id);

  await db.project.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { name: project.name, code: project.code },
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function updateProjectStatus(id: string, status: ProjectStatus) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  const updateData: Record<string, unknown> = { status };
  const mappedStageId = await getStageIdForStatus(status);
  if (mappedStageId) {
    updateData.stageId = mappedStageId;
  }

  if (status === "COMPLETED") {
    updateData.completedAt = new Date();
    updateData.progress = 100;
  }

  if (status === "IN_PROGRESS" && !project.startDate) {
    updateData.startDate = new Date();
  }

  const updated = await db.project.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "STATUS_CHANGE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { oldStatus: project.status, newStatus: status },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function holdProject(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const validatedFields = holdProjectSchema.safeParse({
    reason: formData.get("reason"),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  if (project.status === "ON_HOLD") {
    return { error: "Project is already on hold" };
  }

  const updated = await db.project.update({
    where: { id },
    data: {
      status: "ON_HOLD",
      stageId: await getStageIdForStatus("ON_HOLD"),
      holdReason: validatedFields.data.reason,
      holdStartDate: new Date(),
    },
  });

  await logActivity({
    action: "HOLD",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { reason: validatedFields.data.reason },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function restartProject(id: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  const project = await db.project.findUnique({ where: { id } });

  if (!project) {
    return { error: "Project not found" };
  }

  if (project.status !== "ON_HOLD") {
    return { error: "Project is not on hold" };
  }

  let holdDays = 0;
  if (project.holdStartDate) {
    holdDays = Math.ceil(
      (new Date().getTime() - project.holdStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  const updateData: Record<string, unknown> = {
    status: "IN_PROGRESS",
    stageId: await getStageIdForStatus("IN_PROGRESS"),
    holdReason: null,
    holdStartDate: null,
    totalHoldDays: project.totalHoldDays + holdDays,
  };

  // Optionally extend deadline by hold days
  if (project.deadline) {
    updateData.deadline = new Date(
      project.deadline.getTime() + holdDays * 24 * 60 * 60 * 1000
    );
  }

  const updated = await db.project.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "RESTART",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { holdDays },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: updated };
}

export async function updateProjectProgress(id: string, progress: number) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(id);

  if (progress < 0 || progress > 100) {
    return { error: "Progress must be between 0 and 100" };
  }

  const project = await db.project.update({
    where: { id },
    data: { progress },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: id,
    createdById: user.id,
    metadata: { progress },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  return { success: true, data: project };
}

export async function updateProjectStage(projectId: string, stageId: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(projectId);

  const [project, stage] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { id: true, stageId: true } }),
    db.projectStage.findUnique({ where: { id: stageId }, select: { id: true, name: true } }),
  ]);

  if (!project) return { error: "Project not found" };
  if (!stage) return { error: "Stage not found" };

  const updated = await db.project.update({
    where: { id: projectId },
    data: { stageId: stage.id },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project",
    entityId: projectId,
    createdById: user.id,
    metadata: { oldStageId: project.stageId, newStageId: stage.id, newStageName: stage.name },
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { success: true, data: updated };
}

export async function createProjectStage(formData: FormData) {
  const user = await requireActionPermission("CREATE", "PROJECT");
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Stage name is required" };

  const existing = await db.projectStage.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return { error: "Stage already exists" };

  const last = await db.projectStage.findFirst({
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
  });

  const stage = await db.projectStage.create({
    data: {
      name,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  await logActivity({
    action: "CREATE",
    entityType: "project-stage",
    entityId: stage.id,
    createdById: user.id,
    metadata: { name: stage.name },
  });

  revalidatePath("/projects");
  return { success: true, data: stage };
}

export async function renameProjectStage(stageId: string, name: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  const trimmedName = name.trim();

  if (!trimmedName) return { error: "Stage name is required" };

  const stage = await db.projectStage.findUnique({ where: { id: stageId } });
  if (!stage) return { error: "Stage not found" };

  const existing = await db.projectStage.findFirst({
    where: {
      id: { not: stageId },
      name: { equals: trimmedName, mode: "insensitive" },
    },
  });
  if (existing) return { error: "Stage already exists" };

  const updated = await db.projectStage.update({
    where: { id: stageId },
    data: { name: trimmedName },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "project-stage",
    entityId: stageId,
    createdById: user.id,
    metadata: { oldName: stage.name, newName: updated.name },
  });

  revalidatePath("/projects");
  return { success: true, data: updated };
}

export async function deleteProjectStage(stageId: string) {
  const user = await requireActionPermission("DELETE", "PROJECT");

  const stage = await db.projectStage.findUnique({ where: { id: stageId } });
  if (!stage) return { error: "Stage not found" };

  const allStages = await db.projectStage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (allStages.length <= 1) {
    return { error: "At least one stage is required" };
  }

  const fallback = allStages.find((item) => item.id !== stageId);
  if (!fallback) {
    return { error: "Fallback stage not found" };
  }

  await db.project.updateMany({
    where: { stageId },
    data: { stageId: fallback.id },
  });

  await db.projectStage.delete({ where: { id: stageId } });

  await logActivity({
    action: "DELETE",
    entityType: "project-stage",
    entityId: stageId,
    createdById: user.id,
    metadata: { name: stage.name, movedTo: fallback.name },
  });

  revalidatePath("/projects");
  return { success: true };
}

export async function getProjectStats(projectId: string) {
  try {
    await requireModuleAccess("PROJECT");
    await requireProjectRecordAccess(projectId);

    const totalHours = await db.timeEntry.aggregate({
      where: { projectId },
      _sum: { hours: true },
    });

    const hoursByUser = await db.timeEntry.groupBy({
      by: ["userId"],
      where: { projectId },
      _sum: { hours: true },
    });

    return {
      totalHours: totalHours._sum.hours || 0,
      hoursByUser,
    };
  } catch (error) {
    if (isDatabaseConnectionError(error) || isProjectAccessError(error)) {
      return {
        totalHours: 0,
        hoursByUser: [],
      };
    }
    throw error;
  }
}
