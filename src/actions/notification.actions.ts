"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ActivityAction, Prisma } from "@prisma/client";

export type AppNotificationDetail =
  | {
      kind: "employee_scheduled_activity";
      activityLabel: string;
      summary: string;
      dueDate: string;
      meetingTime?: string;
      meetingEndTime?: string;
      note: string;
      flow: string;
      createdByName: string;
    };

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  detail?: AppNotificationDetail;
}

const notificationCache = new Map<string, { expiresAt: number; data: AppNotification[] }>();

function getNotificationContent(log: {
  action: ActivityAction;
  entityType: string;
  metadata: unknown;
  createdBy: { name: string };
}, isRecipient: boolean): { title: string; message: string; detail?: AppNotificationDetail } | null {
  const metadata =
    log.metadata && typeof log.metadata === "object"
      ? (log.metadata as Record<string, unknown>)
      : {};

  if (log.action === "ASSIGN" && log.entityType === "project_manager") {
    const projectName = String(metadata.projectName ?? "project");
    return isRecipient
      ? {
          title: "Project Assigned",
          message: `${log.createdBy.name} assigned you as BA for ${projectName}.`,
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
            message: `${log.createdBy.name} assigned you to team project ${projectName}.`,
          }
        : {
            title: "Team Assigned",
            message: `You assigned team members to ${projectName}.`,
          };
    }
    return isRecipient
      ? {
          title: "Project Assigned",
          message: `${log.createdBy.name} assigned ${projectName} to you.`,
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
          message: `${log.createdBy.name} assigned task "${taskTitle}" to you.`,
        }
      : {
          title: "Task Assigned",
          message: `You assigned task "${taskTitle}".`,
        };
  }

  if (
    (log.action === "CREATE" || log.action === "UPDATE") &&
    log.entityType === "employee_scheduled_activity_notification"
  ) {
    const summary = String(metadata.summary ?? "activity").trim() || "activity";
    const activityLabel = String(metadata.activityLabel ?? "Activity").trim() || "Activity";
    const dueDate = String(metadata.dueDate ?? "").trim();
    const dueDateText = dueDate ? ` for ${dueDate}` : "";
    const meetingTime =
      typeof metadata.meetingTime === "string" && metadata.meetingTime.trim()
        ? metadata.meetingTime.trim()
        : undefined;
    const meetingEndTime =
      typeof metadata.meetingEndTime === "string" && metadata.meetingEndTime.trim()
        ? metadata.meetingEndTime.trim()
        : undefined;
    const note = String(metadata.note ?? "").trim();
    const flow = String(metadata.flow ?? "").trim();
    const verb = log.action === "UPDATE" ? "updated" : "scheduled";

    return isRecipient
      ? {
          title: log.action === "UPDATE" ? "Scheduled Activity Updated" : "New Scheduled Activity",
          message: `${log.createdBy.name} ${verb} "${summary}"${dueDateText}.`,
          detail: {
            kind: "employee_scheduled_activity",
            activityLabel,
            summary,
            dueDate,
            meetingTime,
            meetingEndTime,
            note,
            flow,
            createdByName: log.createdBy.name,
          },
        }
      : {
          title: log.action === "UPDATE" ? "Scheduled Activity Updated" : "Scheduled Activity",
          message: `You ${verb} "${summary}"${dueDateText}.`,
          detail: {
            kind: "employee_scheduled_activity",
            activityLabel,
            summary,
            dueDate,
            meetingTime,
            meetingEndTime,
            note,
            flow,
            createdByName: log.createdBy.name,
          },
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

export async function getMyNotifications(limit = 25) {
  const user = await requireAuth();
  const cacheKey = `${user.id}:${Math.max(1, Math.min(50, limit))}`;
  const now = Date.now();
  const cached = notificationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let logs: Array<Prisma.ActivityLogGetPayload<{ include: { createdBy: { select: { name: true } } } }>> = [];
  try {
    logs = await db.activityLog.findMany({
      where: {
        AND: [
          {
            OR: [{ createdById: user.id }, { userId: user.id }],
          },
          {
          OR: [
            { action: "ASSIGN", entityType: "project_manager" },
            { action: "ASSIGN", entityType: "project" },
            { action: "CREATE", entityType: "project_task" },
            { action: "CREATE", entityType: "employee_scheduled_activity_notification" },
            { action: "UPDATE", entityType: "employee_scheduled_activity_notification" },
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

  const notifications: AppNotification[] = [];

  for (const log of logs) {
    if (log.entityType === "admin_message") {
      const metadata =
        log.metadata && typeof log.metadata === "object"
          ? (log.metadata as Record<string, unknown>)
          : {};
      const targetRole = String(metadata.targetRole ?? "ALL").toUpperCase();
      const isAllowed =
        targetRole === "ALL" ||
        (targetRole === "TEAMLEADER" && user.role === "TEAMLEADER") ||
        (targetRole === "BA" && user.role === "BA") ||
        (targetRole === "EMPLOYEE" && user.role === "EMPLOYEE");
      if (!isAllowed) {
        continue;
      }
    }

    const isRecipient = log.userId === user.id;
    if (log.entityType === "role_message" && !isRecipient) {
      continue;
    }
    const content = getNotificationContent(log, isRecipient);
    if (!content) continue;
    notifications.push({
      id: log.id,
      title: content.title,
      message: content.message,
      createdAt: log.createdAt.toISOString(),
      detail: content.detail,
    });
  }

  notificationCache.set(cacheKey, {
    data: notifications,
    expiresAt: now + 15000,
  });

  return notifications;
}
