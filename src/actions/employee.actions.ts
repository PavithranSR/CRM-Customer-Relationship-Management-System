"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  DEFAULT_EMPLOYEE_DEPARTMENTS,
  DEFAULT_POSITIONS_BY_DEPARTMENT,
} from "@/lib/employee-options";
import { createEmployeeSchema, updateEmployeeSchema } from "@/lib/validations/employee.schema";
import { parseEmployeePermissionsFromFormData } from "@/lib/employee-permissions";
import { ensureTimeEntrySchemaReady } from "@/lib/time-entry-schema.server";
import { logActivity } from "./activity-log.actions";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";

const EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE = "employee_scheduled_activity";
const EMPLOYEE_SCHEDULED_ACTIVITY_NOTIFICATION_ENTITY_TYPE = "employee_scheduled_activity_notification";
const EMPLOYEE_SCHEDULED_ACTIVITY_TYPES = ["todo", "email", "call", "meeting", "document", "requestSignature"] as const;
const EMPLOYEE_SCHEDULED_ACTIVITY_FLOWS = ["offboarding", "onboarding"] as const;

type EmployeeScheduledActivityType = (typeof EMPLOYEE_SCHEDULED_ACTIVITY_TYPES)[number];
type EmployeeScheduledActivityFlow = (typeof EMPLOYEE_SCHEDULED_ACTIVITY_FLOWS)[number];

export type EmployeeScheduledActivityRecord = {
  id: string;
  ownerId: string;
  assigneeId: string;
  type: EmployeeScheduledActivityType;
  summary: string;
  dueDate: string;
  meetingTime?: string;
  meetingEndTime?: string;
  note: string;
  flow: EmployeeScheduledActivityFlow;
};

type EmployeeScheduledActivityMetadata = EmployeeScheduledActivityRecord & {
  isCompleted?: boolean;
  status?: "done" | "cancelled";
};

async function ensureEmployeeDepartmentsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "employee_departments" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdById" TEXT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "employee_departments_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "employee_departments_name_lower_unique_idx"
    ON "employee_departments" (LOWER("name"))
  `;
}

async function ensureEmployeePositionsTable() {
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "employee_positions" (
      "id" TEXT NOT NULL,
      "departmentName" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdById" TEXT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("id")
    )
  `;
  await db.$executeRaw`
    CREATE INDEX IF NOT EXISTS "employee_positions_department_name_idx"
    ON "employee_positions" ("departmentName")
  `;
  await db.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "employee_positions_department_name_lower_unique_idx"
    ON "employee_positions" (LOWER("departmentName"), LOWER("name"))
  `;
}

async function seedDefaultEmployeeDepartments() {
  await ensureEmployeeDepartmentsTable();

  for (const department of DEFAULT_EMPLOYEE_DEPARTMENTS) {
    await db.$executeRaw`
      INSERT INTO "employee_departments" (
        "id",
        "name",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${department},
        NOW(),
        NOW()
      )
      ON CONFLICT DO NOTHING
    `;
  }
}

async function seedDefaultEmployeePositions() {
  await seedDefaultEmployeeDepartments();
  await ensureEmployeePositionsTable();

  for (const [department, positions] of Object.entries(DEFAULT_POSITIONS_BY_DEPARTMENT)) {
    for (const position of positions) {
      await db.$executeRaw`
        INSERT INTO "employee_positions" (
          "id",
          "departmentName",
          "name",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${crypto.randomUUID()},
          ${department},
          ${position},
          NOW(),
          NOW()
        )
        ON CONFLICT DO NOTHING
      `;
    }
  }
}

async function ensureEmployeeOptionValues(
  departmentName: string | null | undefined,
  positionName: string | null | undefined,
  createdById: string
) {
  const department = departmentName?.trim();
  const position = positionName?.trim();

  if (!department) {
    return;
  }

  await seedDefaultEmployeeDepartments();
  await db.$executeRaw`
    INSERT INTO "employee_departments" (
      "id",
      "name",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${department},
      ${createdById},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
  `;

  if (!position) {
    return;
  }

  await ensureEmployeePositionsTable();
  await db.$executeRaw`
    INSERT INTO "employee_positions" (
      "id",
      "departmentName",
      "name",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${department},
      ${position},
      ${createdById},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
  `;
}

export async function getEmployeeDepartmentOptions() {
  await requireAdmin();
  await seedDefaultEmployeeDepartments();

  const rows = await db.$queryRaw<Array<{ name: string }>>`
    SELECT DISTINCT "name"
    FROM (
      SELECT "name"
      FROM "employee_departments"
      WHERE BTRIM("name") <> ''
      UNION
      SELECT "department" AS "name"
      FROM "users"
      WHERE "department" IS NOT NULL AND BTRIM("department") <> ''
    ) departments
    ORDER BY "name" ASC
  `;

  return rows.map((row) => row.name);
}

export async function getEmployeePositionOptionsByDepartment() {
  await requireAdmin();
  await seedDefaultEmployeePositions();

  const rows = await db.$queryRaw<Array<{ departmentName: string; name: string }>>`
    SELECT DISTINCT "departmentName", "name"
    FROM (
      SELECT "departmentName", "name"
      FROM "employee_positions"
      WHERE BTRIM("departmentName") <> '' AND BTRIM("name") <> ''
      UNION
      SELECT "department" AS "departmentName", "position" AS "name"
      FROM "users"
      WHERE
        "department" IS NOT NULL AND BTRIM("department") <> ''
        AND "position" IS NOT NULL AND BTRIM("position") <> ''
    ) positions
    ORDER BY "departmentName" ASC, "name" ASC
  `;

  return rows.reduce<Record<string, string[]>>((result, row) => {
    result[row.departmentName] = [...(result[row.departmentName] ?? []), row.name];
    return result;
  }, {});
}

export async function createEmployeeDepartment(name: string) {
  const admin = await requireAdmin();
  const trimmed = name.trim();

  if (!trimmed) {
    return { error: "Department name is required" };
  }

  await seedDefaultEmployeeDepartments();
  await db.$executeRaw`
    INSERT INTO "employee_departments" (
      "id",
      "name",
      "createdById",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${crypto.randomUUID()},
      ${trimmed},
      ${admin.id},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
  `;

  const rows = await db.$queryRaw<Array<{ name: string }>>`
    SELECT "name"
    FROM "employee_departments"
    WHERE LOWER("name") = LOWER(${trimmed})
    LIMIT 1
  `;

  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return { success: true as const, data: { name: rows[0]?.name ?? trimmed } };
}

export async function createEmployeePosition(departmentName: string, name: string) {
  const admin = await requireAdmin();
  const department = departmentName.trim();
  const position = name.trim();

  if (!department) {
    return { error: "Department is required" };
  }

  if (!position) {
    return { error: "Position name is required" };
  }

  await ensureEmployeeOptionValues(department, position, admin.id);

  const rows = await db.$queryRaw<Array<{ departmentName: string; name: string }>>`
    SELECT "departmentName", "name"
    FROM "employee_positions"
    WHERE LOWER("departmentName") = LOWER(${department}) AND LOWER("name") = LOWER(${position})
    LIMIT 1
  `;

  revalidatePath("/employees");
  revalidatePath("/employees/new");
  return {
    success: true as const,
    data: {
      departmentName: rows[0]?.departmentName ?? department,
      name: rows[0]?.name ?? position,
    },
  };
}

const employeeScheduledActivityTypeLabels: Record<EmployeeScheduledActivityType, string> = {
  todo: "To-Do",
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  document: "Document",
  requestSignature: "Request Signature",
};

function isEmployeeScheduledActivityType(value: unknown): value is EmployeeScheduledActivityType {
  return typeof value === "string" && EMPLOYEE_SCHEDULED_ACTIVITY_TYPES.includes(value as EmployeeScheduledActivityType);
}

function isEmployeeScheduledActivityFlow(value: unknown): value is EmployeeScheduledActivityFlow {
  return typeof value === "string" && EMPLOYEE_SCHEDULED_ACTIVITY_FLOWS.includes(value as EmployeeScheduledActivityFlow);
}

function parseEmployeeScheduledActivityRecord(metadata: unknown): EmployeeScheduledActivityMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata as Record<string, unknown>;

  if (
    typeof value.id !== "string" ||
    typeof value.ownerId !== "string" ||
    typeof value.assigneeId !== "string" ||
    !isEmployeeScheduledActivityType(value.type) ||
    typeof value.summary !== "string" ||
    typeof value.dueDate !== "string" ||
    typeof value.note !== "string" ||
    !isEmployeeScheduledActivityFlow(value.flow)
  ) {
    return null;
  }

  return {
    id: value.id,
    ownerId: value.ownerId,
    assigneeId: value.assigneeId,
    type: value.type,
    summary: value.summary,
    dueDate: value.dueDate,
    meetingTime: typeof value.meetingTime === "string" ? value.meetingTime : undefined,
    meetingEndTime: typeof value.meetingEndTime === "string" ? value.meetingEndTime : undefined,
    note: value.note,
    flow: value.flow,
    isCompleted: value.isCompleted === true,
  };
}

function getEmployeeScheduledActivityEntityId(ownerId: string, type: EmployeeScheduledActivityType) {
  return `${ownerId}:${type}`;
}

export async function getEmployees() {
  return db.user.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      teamId: true,
      team: {
        select: {
          id: true,
          name: true,
        },
      },
      permissions: true,
      phone: true,
      hireDate: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          assignments: { where: { isActive: true } },
          timeEntries: true,
        },
      },
    },
  });
}

export async function getEmployee(id: string) {
  await ensureTimeEntrySchemaReady();

  return db.user.findUnique({
    where: { id },
    include: {
      assignments: {
        where: { isActive: true },
        include: {
          project: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
      },
      timeEntries: {
        orderBy: { date: "desc" },
        take: 10,
        include: {
          project: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });
}

export async function getEmployeeScheduledActivities() {
  await requireAdmin();

  const logs = await db.activityLog.findMany({
    where: { entityType: EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE },
    orderBy: { createdAt: "desc" },
  });

  const latestByEntityId = new Map<string, EmployeeScheduledActivityRecord>();
  const processedEntityIds = new Set<string>();

  for (const log of logs) {
    if (processedEntityIds.has(log.entityId)) {
      continue;
    }

    const record = parseEmployeeScheduledActivityRecord(log.metadata);

    if (!record) {
      continue;
    }

    processedEntityIds.add(log.entityId);

    if (record.isCompleted) {
      continue;
    }

    latestByEntityId.set(log.entityId, {
      id: record.id,
      ownerId: record.ownerId,
      assigneeId: record.assigneeId,
      type: record.type,
      summary: record.summary,
      dueDate: record.dueDate,
      meetingTime: record.meetingTime,
      meetingEndTime: record.meetingEndTime,
      note: record.note,
      flow: record.flow,
    });
  }

  return Array.from(latestByEntityId.values()).sort((a, b) => {
    const byOwner = a.ownerId.localeCompare(b.ownerId);

    if (byOwner !== 0) {
      return byOwner;
    }

    return a.type.localeCompare(b.type);
  });
}

export async function saveEmployeeScheduledActivity(activity: EmployeeScheduledActivityRecord) {
  const admin = await requireAdmin();
  const entityId = getEmployeeScheduledActivityEntityId(activity.ownerId, activity.type);

  try {
    const existing = await db.activityLog.findFirst({
      where: {
        entityType: EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });

    const saved = await db.activityLog.create({
      data: {
        action: existing ? "UPDATE" : "CREATE",
        entityType: EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE,
        entityId,
        userId: activity.ownerId,
        createdById: admin.id,
        metadata: {
          ...activity,
          isCompleted: false,
        } as Prisma.InputJsonValue,
      },
    });

    await logActivity({
      action: existing ? "UPDATE" : "CREATE",
      entityType: "employee_schedule_activity_audit",
      entityId: saved.id,
      userId: activity.ownerId,
      createdById: admin.id,
      metadata: {
        activityType: activity.type,
        assigneeId: activity.assigneeId,
        dueDate: activity.dueDate,
        flow: activity.flow,
      },
    });

    await logActivity({
      action: existing ? "UPDATE" : "CREATE",
      entityType: EMPLOYEE_SCHEDULED_ACTIVITY_NOTIFICATION_ENTITY_TYPE,
      entityId: saved.id,
      userId: activity.assigneeId,
      createdById: admin.id,
      metadata: {
        activityId: activity.id,
        activityType: activity.type,
        activityLabel: employeeScheduledActivityTypeLabels[activity.type],
        summary: activity.summary,
        dueDate: activity.dueDate,
        ...(activity.meetingTime ? { meetingTime: activity.meetingTime } : {}),
        ...(activity.meetingEndTime ? { meetingEndTime: activity.meetingEndTime } : {}),
        note: activity.note,
        flow: activity.flow,
        ownerId: activity.ownerId,
        assigneeId: activity.assigneeId,
      },
    });

    revalidatePath("/employees");
    return { success: true as const, data: activity };
  } catch {
    return { success: false as const, error: "Unable to save employee activity" };
  }
}

async function finalizeEmployeeScheduledActivity(
  ownerId: string,
  type: EmployeeScheduledActivityType,
  status: "done" | "cancelled"
) {
  const admin = await requireAdmin();
  const entityId = getEmployeeScheduledActivityEntityId(ownerId, type);

  try {
    const latest = await db.activityLog.findFirst({
      where: {
        entityType: EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE,
        entityId,
      },
      orderBy: { createdAt: "desc" },
    });

    const record = parseEmployeeScheduledActivityRecord(latest?.metadata);

    if (!record) {
      return { success: false as const, error: "Activity not found" };
    }

    await db.activityLog.create({
      data: {
        action: "UPDATE",
        entityType: EMPLOYEE_SCHEDULED_ACTIVITY_ENTITY_TYPE,
        entityId,
        userId: ownerId,
        createdById: admin.id,
        metadata: {
          ...record,
          isCompleted: true,
          status,
        } as Prisma.InputJsonValue,
      },
    });

    await logActivity({
      action: "UPDATE",
      entityType: "employee_schedule_activity_audit",
      entityId,
      userId: ownerId,
      createdById: admin.id,
      metadata: {
        activityType: type,
        status,
      },
    });

    revalidatePath("/employees");
    return { success: true as const };
  } catch {
    return { success: false as const, error: "Unable to update employee activity" };
  }
}

export async function markEmployeeScheduledActivityDone(ownerId: string, type: EmployeeScheduledActivityType) {
  return finalizeEmployeeScheduledActivity(ownerId, type, "done");
}

export async function cancelEmployeeScheduledActivity(ownerId: string, type: EmployeeScheduledActivityType) {
  return finalizeEmployeeScheduledActivity(ownerId, type, "cancelled");
}

export async function createEmployee(formData: FormData) {
  const admin = await requireAdmin();

  const validatedFields = createEmployeeSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate") || undefined,
    permissions: parseEmployeePermissionsFromFormData(formData),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password, permissions, ...data } = validatedFields.data;

  const existingUser = await db.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    return { error: "Email already in use" };
  }

  await ensureEmployeeOptionValues(data.department, data.position, admin.id);

  const hashedPassword = await bcrypt.hash(password, 10);

  const createData: Prisma.UserCreateInput = {
    ...data,
    password: hashedPassword,
    permissions,
  };

  const employee = await db.user.create({ data: createData });

  await logActivity({
    action: "CREATE",
    entityType: "user",
    entityId: employee.id,
    userId: employee.id,
    createdById: admin.id,
    metadata: { name: employee.name, email: employee.email, role: employee.role },
  });

  revalidatePath("/employees");
  return { success: true, data: employee };
}

export async function updateEmployee(id: string, formData: FormData) {
  const admin = await requireAdmin();

  const validatedFields = updateEmployeeSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email") || undefined,
    password: formData.get("password") || undefined,
    role: formData.get("role") || undefined,
    department: formData.get("department") || undefined,
    position: formData.get("position") || undefined,
    phone: formData.get("phone") || undefined,
    hireDate: formData.get("hireDate") || undefined,
    isActive: formData.get("isActive") === "true",
    permissions: parseEmployeePermissionsFromFormData(formData),
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { password, permissions, ...data } = validatedFields.data;

  // Check if email is being changed and if it's already in use
  if (data.email) {
    const existingUser = await db.user.findFirst({
      where: { email: data.email, NOT: { id } },
    });

    if (existingUser) {
      return { error: "Email already in use" };
    }
  }

  const updateData: Prisma.UserUpdateInput = { ...data };

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }
  updateData.permissions = permissions;

  await ensureEmployeeOptionValues(data.department, data.position, admin.id);

  const employee = await db.user.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    userId: id,
    createdById: admin.id,
    metadata: { changes: Object.keys(data) },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { success: true, data: employee };
}

export async function deleteEmployee(id: string) {
  const admin = await requireAdmin();

  const employee = await db.user.findUnique({ where: { id } });

  if (!employee) {
    return { error: "Employee not found" };
  }

  if (employee.id === admin.id) {
    return { error: "Cannot delete yourself" };
  }

  await db.user.delete({ where: { id } });

  await logActivity({
    action: "DELETE",
    entityType: "user",
    entityId: id,
    createdById: admin.id,
    metadata: { name: employee.name, email: employee.email },
  });

  revalidatePath("/employees");
  return { success: true };
}

export async function toggleEmployeeStatus(id: string) {
  const admin = await requireAdmin();

  const employee = await db.user.findUnique({ where: { id } });

  if (!employee) {
    return { error: "Employee not found" };
  }

  if (employee.id === admin.id) {
    return { error: "Cannot deactivate yourself" };
  }

  const updated = await db.user.update({
    where: { id },
    data: { isActive: !employee.isActive },
  });

  await logActivity({
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    userId: id,
    createdById: admin.id,
    metadata: { isActive: updated.isActive },
  });

  revalidatePath("/employees");
  return { success: true, data: updated };
}
