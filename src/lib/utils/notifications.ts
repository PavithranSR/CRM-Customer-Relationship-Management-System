"use server";

import { ActivityAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export interface DashboardNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

const notificationCache = new Map<string, { expiresAt: number; data: DashboardNotification[] }>();

function buildNotificationContent(
  log: {
    action: ActivityAction;
    entityType: string;
    metadata: unknown;
    createdBy: { name: string | null };
  },
  isRecipient: boolean
): { title: string; message: string } | null {
  const metadata =
    log.metadata && typeof log.metadata === "object"
      ? (log.metadata as Record<string, unknown>)
      : {};
  const senderName = log.createdBy.name ?? "Someone";

  if (log.action === "ASSIGN" && log.entityType === "project_manager") {
    const projectName = String(metadata.projectName ?? "project");
    return isRecipient
      ? {
          title: "Project Assigned",
          message: `${senderName} assigned you as BA for ${projectName}.`,
        }
      : {
          title: "BA Assigned",
          message: `You assigned BA for ${projectName}.`,
        };
  }

  if (log.action === "ASSIGN" && log.entityType === "project") {
    const projectName = String(metadata.projectName ?? "project");
    const employeeName = String(metadata.employeeName ?? "member");
    const mode = String(metadata.assignmentMode ?? "");

    if (mode === "TEAM") {
      return isRecipient
        ? {
            title: "Team Project Assigned",
            message: `${senderName} assigned you to team project ${projectName}.`,
          }
        : {
            title: "Team Assigned",
            message: `You assigned team members to ${projectName}.`,
          };
    }

    return isRecipient
      ? {
          title: "Project Assigned",
          message: `${senderName} assigned ${projectName} to you.`,
        }
      : {
          title: "Project Assigned",
          message: `You assigned ${projectName} to ${employeeName}.`,
        };
  }

  if (log.action === "CREATE" && log.entityType === "project_task") {
    const taskTitle = String(metadata.title ?? "task");
    return isRecipient
      ? {
          title: "New Task Assigned",
          message: `${senderName} assigned task "${taskTitle}" to you.`,
        }
      : {
          title: "Task Assigned",
          message: `You assigned task "${taskTitle}".`,
        };
  }

  if (log.action === "CREATE" && log.entityType === "admin_message") {
    const message = String(metadata.message ?? "").trim();
    return {
      title: "Admin Message",
      message: message || "You have a new message from admin.",
    };
  }

  if (log.action === "CREATE" && log.entityType === "role_message") {
    const message = String(metadata.message ?? "").trim();
    return {
      title: "Message",
      message: message || "You have a new message.",
    };
  }

  return null;
}

export async function getDashboardNotificationsForUser(
  userId?: string,
  limit = 25
): Promise<DashboardNotification[]> {
  const session = await requireAuth().catch(() => null);
  const resolvedUserId = userId ?? session?.id;

  if (!resolvedUserId) {
    return [];
  }

  const cacheKey = `${resolvedUserId}:${Math.max(1, Math.min(50, limit))}`;
  const now = Date.now();
  const cached = notificationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let logs: Array<
    Prisma.ActivityLogGetPayload<{ include: { createdBy: { select: { name: true } } } }>
  > = [];

  try {
    logs = await db.activityLog.findMany({
      where: {
        AND: [
          {
            OR: [{ createdById: resolvedUserId }, { userId: resolvedUserId }],
          },
          {
            OR: [
              { action: "ASSIGN", entityType: "project_manager" },
              { action: "ASSIGN", entityType: "project" },
              { action: "CREATE", entityType: "project_task" },
              { action: "CREATE", entityType: "admin_message" },
              { action: "CREATE", entityType: "role_message" },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(50, limit)),
      include: {
        createdBy: { select: { name: true } },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2024" || error.code === "P1001")
    ) {
      return [];
    }

    return [];
  }

  const notifications: DashboardNotification[] = [];

  for (const log of logs) {
    if (log.entityType === "admin_message") {
      const metadata =
        log.metadata && typeof log.metadata === "object"
          ? (log.metadata as Record<string, unknown>)
          : {};
      const targetRole = String(metadata.targetRole ?? "ALL").toUpperCase();
      const userRole = session?.role;
      const isAllowed =
        targetRole === "ALL" ||
        (targetRole === "TEAMLEADER" && userRole === "TEAMLEADER") ||
        (targetRole === "BA" && userRole === "BA") ||
        (targetRole === "EMPLOYEE" && userRole === "EMPLOYEE") ||
        userRole === "ADMIN";

      if (!isAllowed) {
        continue;
      }
    }

    const isRecipient = log.userId === resolvedUserId;
    if (log.entityType === "role_message" && !isRecipient) {
      continue;
    }

    const content = buildNotificationContent(log, isRecipient);
    if (!content) {
      continue;
    }

    notifications.push({
      id: log.id,
      title: content.title,
      message: content.message,
      createdAt: log.createdAt.toISOString(),
    });
  }

  notificationCache.set(cacheKey, {
    data: notifications,
    expiresAt: now + 15_000,
  });

  return notifications;
}
