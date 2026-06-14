"use server";

import { db } from "@/lib/db";
import { ActivityAction, Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { buildProjectWhereForViewer, normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { requireAuth, requireModuleAccess, requireProjectRecordAccess } from "@/lib/auth";

type MetadataValue = string | number | boolean | null | string[] | undefined;

interface LogActivityParams {
  action: ActivityAction;
  entityType: string;
  entityId: string;
  userId?: string;
  createdById: string;
  metadata?: Record<string, MetadataValue>;
}

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P2024")
  );
}

export async function logActivity(params: LogActivityParams) {
  const headersList = await headers();
  const ipAddress = headersList.get("x-forwarded-for") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  if (!params.createdById) {
    return null;
  }

  try {
    return await db.activityLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        createdById: params.createdById,
        metadata: params.metadata as object,
        ipAddress,
        userAgent,
      },
    });
  } catch {
    // Do not block core flows if activity logging fails (e.g. missing user FK in dev).
    return null;
  }
}

export async function getActivityLogs(filters?: {
  action?: ActivityAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const user = await requireAuth();
  const normalizedPermissions = normalizeEmployeePermissions(user.permissions);
  const hasProjectModule = user.role === "ADMIN" || normalizedPermissions.moduleAccess.includes("PROJECT");

  if (!hasProjectModule) {
    throw new Error("Forbidden: Missing module access PROJECT");
  }

  const hasGlobalRecordScope =
    user.role === "ADMIN" || normalizedPermissions.recordRules.includes("RECORD_RULES");
  const hasTeamScope =
    normalizedPermissions.recordRules.includes("TEAM_RECORD") ||
    normalizedPermissions.recordRules.includes("ASSIGN_PROJECT");

  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: normalizedPermissions,
  });

  return db.activityLog.findMany({
    where: {
      ...(filters?.action && { action: filters.action }),
      ...(filters?.entityType && { entityType: filters.entityType }),
      ...(filters?.entityId && { entityId: filters.entityId }),
      ...(filters?.userId && { userId: filters.userId }),
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
      ...(!hasGlobalRecordScope && {
        OR: [
          { createdById: user.id },
          { userId: user.id },
          ...(hasTeamScope ? [{ project: projectWhere }] : []),
        ],
      }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters?.limit || 50,
    skip: filters?.offset || 0,
  });
}

export async function getTaskActivityLogs(projectId: string, taskId: string) {
  try {
    await requireModuleAccess("PROJECT");
    await requireProjectRecordAccess(projectId);

    return await db.activityLog.findMany({
      where: {
        projectId,
        OR: [
          { entityType: "project_task", entityId: taskId },
          { entityType: "task_comment", entityId: taskId },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return [];
    }
    throw error;
  }
}
