"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAuth,
  requireProjectRecordAccess,
} from "@/lib/auth";
import { Role } from "@prisma/client";

export interface IndividualProjectUpdateItem {
  id: string;
  comment: string;
  completedToday: number;
  totalCompleted: number;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

async function getProjectContext(projectId: string) {
  const user = await requireAuth();
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      type: true,
      managerId: true,
      assignments: {
        where: { isActive: true },
        select: {
          userId: true,
          user: {
            select: { role: true },
          },
        },
      },
    },
  });

  if (!project) return { error: "Project not found" as const };
  try {
    await requireProjectRecordAccess(projectId);
  } catch {
    return { error: "Forbidden" as const };
  }
  if (project.type !== "INDIVIDUAL") {
    return { error: "Daily individual updates are only for INDIVIDUAL projects" as const };
  }

  const isAssignedEmployee = project.assignments.some(
    (assignment) =>
      assignment.userId === user.id && assignment.user.role === "EMPLOYEE"
  );
  const isAssignedTeamLeader = project.assignments.some(
    (assignment) =>
      assignment.userId === user.id && assignment.user.role === "TEAMLEADER"
  );
  const isAssignedWorker = isAssignedEmployee || isAssignedTeamLeader;
  const isManagerBa = user.role === "BA" && project.managerId === user.id;
  const canView = user.role === "ADMIN" || isManagerBa || isAssignedWorker;

  if (!canView) return { error: "Forbidden" as const };

  return { user, project, isAssignedEmployee, isAssignedTeamLeader, isAssignedWorker, isManagerBa };
}

export async function getIndividualProjectUpdates(projectId: string) {
  const context = await getProjectContext(projectId);
  if ("error" in context) return { error: context.error, data: [] as IndividualProjectUpdateItem[] };

  const updates = await db.activityLog.findMany({
    where: {
      projectId,
      entityType: "individual_project_daily_update",
      entityId: projectId,
    },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  let runningTotal = 0;
  const mapped = updates.map((update) => {
      const metadata =
        update.metadata && typeof update.metadata === "object"
          ? (update.metadata as Record<string, unknown>)
          : {};
      const completedTodayRaw = Number(metadata.completedToday ?? 0);
      const completedToday = Number.isFinite(completedTodayRaw)
        ? Math.max(0, Math.min(100, completedTodayRaw))
        : 0;
      runningTotal = Math.max(0, Math.min(100, runningTotal + completedToday));
      return {
        id: update.id,
        comment: String(metadata.comment ?? "").trim(),
        completedToday,
        totalCompleted: runningTotal,
        createdAt: update.createdAt.toISOString(),
        createdBy: update.createdBy,
      };
    });

  return {
    data: mapped.reverse(),
  };
}

export async function addIndividualProjectDailyUpdate(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const comment = String(formData.get("comment") || "").trim();

  if (!projectId || !comment) {
    return { error: "Project and daily comment are required" };
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const context = await getProjectContext(projectId);
  if ("error" in context) return { error: context.error };
  const { user, isAssignedWorker } = context;

  if ((user.role !== "EMPLOYEE" && user.role !== "TEAMLEADER") || !isAssignedWorker) {
    return { error: "Only assigned employee or team leader can add daily work comments for this project" };
  }

  const existing = await db.activityLog.findMany({
    where: {
      projectId,
      entityType: "individual_project_daily_update",
      entityId: projectId,
    },
    orderBy: { createdAt: "asc" },
    select: { metadata: true },
  });

  const completedSoFar = existing.reduce((sum, item) => {
    const metadata =
      item.metadata && typeof item.metadata === "object"
        ? (item.metadata as Record<string, unknown>)
        : {};
    const value = Number(metadata.completedToday ?? 0);
    if (!Number.isFinite(value)) return sum;
    return sum + Math.max(0, Math.min(100, value));
  }, 0);

  const remaining = Math.max(0, 100 - Math.max(0, Math.min(100, completedSoFar)));
  const completedToday = Math.min(10, remaining);
  const nextProgress = Math.max(0, Math.min(100, completedSoFar + completedToday));

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "individual_project_daily_update",
      entityId: projectId,
      projectId,
      userId: user.id,
      createdById: user.id,
      metadata: {
        comment,
        completedToday,
      },
    },
  });

  await db.project.update({
    where: { id: projectId },
    data: { progress: nextProgress },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}
