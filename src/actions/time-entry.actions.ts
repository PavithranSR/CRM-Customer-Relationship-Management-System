"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, ProjectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAuth,
  requireModuleAccess,
  requireProjectRecordAccess,
} from "@/lib/auth";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { createTimeEntrySchema, updateTimeEntrySchema } from "@/lib/validations/time-entry.schema";
import { normalizeTask, type ProjectTask } from "@/lib/project-task-utils";
import { ensureTimeEntrySchemaReady } from "@/lib/time-entry-schema.server";
import { logActivity } from "./activity-log.actions";

const PROJECT_TASK_STATE_ENTITY_TYPE = "project_task_state";
const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["PLANNING", "IN_PROGRESS"];

type CurrentUser = Awaited<ReturnType<typeof requireAuth>>;

export interface WorkTrackingProjectOption {
  id: string;
  name: string;
  code: string;
  memberIds: string[];
}

export interface WorkTrackingTaskOption {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  assigneeIds: string[];
  progress: number;
}

export interface WorkTrackingEmployeeOption {
  id: string;
  name: string;
  role: string;
}

function shouldLimitTaskVisibilityForUser(input: { role: string }) {
  if (input.role === "ADMIN") {
    return false;
  }
  return true;
}

function canManageTimeForOthers(user: CurrentUser) {
  return user.role === "ADMIN";
}

function getTaskAssigneeIds(task: Pick<ProjectTask, "assigneeId" | "employeeAssigneeId" | "assignedTlId">) {
  return Array.from(
    new Set(
      [task.employeeAssigneeId, task.assigneeId, task.assignedTlId]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function canUserSeeTask(task: ProjectTask, userId: string) {
  return getTaskAssigneeIds(task).includes(userId);
}

function canUseTaskForTimeEntry(task: ProjectTask, user: CurrentUser) {
  if (!shouldLimitTaskVisibilityForUser({ role: user.role })) {
    return true;
  }

  return canUserSeeTask(task, user.id);
}

function parseTaskState(metadata: unknown): ProjectTask[] {
  const state = (metadata as { tasks?: unknown[] } | null) ?? null;
  return Array.isArray(state?.tasks)
    ? state.tasks.map(normalizeTask).filter((task): task is ProjectTask => Boolean(task))
    : [];
}

function mergeProjectWhere(
  baseWhere: Prisma.ProjectWhereInput,
  extraWhere: Prisma.ProjectWhereInput
): Prisma.ProjectWhereInput {
  return Object.keys(baseWhere).length > 0
    ? { AND: [baseWhere, extraWhere] }
    : extraWhere;
}

async function readTaskStatesByProject(projectIds: string[]) {
  if (projectIds.length === 0) {
    return new Map<string, ProjectTask[]>();
  }

  const logs = await db.activityLog.findMany({
    where: {
      entityType: PROJECT_TASK_STATE_ENTITY_TYPE,
      entityId: { in: projectIds },
    },
    orderBy: { createdAt: "desc" },
    select: {
      entityId: true,
      metadata: true,
    },
  });

  const tasksByProject = new Map<string, ProjectTask[]>();
  for (const log of logs) {
    if (!tasksByProject.has(log.entityId)) {
      tasksByProject.set(log.entityId, parseTaskState(log.metadata));
    }
  }

  return tasksByProject;
}

async function readProjectTasks(projectId: string) {
  const latest = await db.activityLog.findFirst({
    where: {
      entityType: PROJECT_TASK_STATE_ENTITY_TYPE,
      entityId: projectId,
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });

  return parseTaskState(latest?.metadata);
}

async function resolveProjectTaskForEntry(projectId: string, taskId: string, user: CurrentUser) {
  const tasks = await readProjectTasks(projectId);
  const task = tasks.find((item) => item.id === taskId);

  if (!task) {
    return { error: "Select a task from the chosen project before logging time." as const };
  }

  if (!canUseTaskForTimeEntry(task, user)) {
    return { error: "You can log time only against tasks visible to you." as const };
  }

  return { task };
}

async function resolveTimeEntryEmployee(input: {
  requestedEmployeeId?: string;
  projectId: string;
  task: ProjectTask;
  user: CurrentUser;
}) {
  const canManageOthers = canManageTimeForOthers(input.user);
  const requestedEmployeeId = input.requestedEmployeeId?.trim();
  const targetUserId = canManageOthers && requestedEmployeeId ? requestedEmployeeId : input.user.id;

  if (targetUserId !== input.user.id && !canManageOthers) {
    return { error: "You can log time only for yourself." as const };
  }

  const employee = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, name: true, isActive: true },
  });

  if (!employee || !employee.isActive) {
    return { error: "Selected employee is not active." as const };
  }

  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { managerId: true },
  });
  const isProjectMember = await db.projectAssignment.count({
    where: {
      projectId: input.projectId,
      userId: targetUserId,
      isActive: true,
    },
  });
  const isTaskAssignee = getTaskAssigneeIds(input.task).includes(targetUserId);
  const isProjectManager = project?.managerId === targetUserId;

  if (!isProjectMember && !isTaskAssignee && !isProjectManager) {
    return { error: "Selected employee must belong to the task or project team." as const };
  }

  return { employee };
}

async function updateProjectActualHours(projectId: string) {
  await ensureTimeEntrySchemaReady();

  const totalHours = await db.timeEntry.aggregate({
    where: { projectId },
    _sum: { hours: true },
  });

  await db.project.update({
    where: { id: projectId },
    data: { actualHours: totalHours._sum.hours || 0 },
  });
}

export async function getTimeEntries() {
  const user = await requireModuleAccess("PROJECT");
  await ensureTimeEntrySchemaReady();

  const ownOnly = user.role !== "ADMIN";
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });
  const where = {
    project: projectWhere,
    ...(ownOnly && { userId: user.id }),
  };

  const entries = await db.timeEntry.findMany({
    where,
    orderBy: { date: "desc" },
    select: {
      id: true,
      date: true,
      hours: true,
      description: true,
      isBillable: true,
      status: true,
      taskId: true,
      taskTitle: true,
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, code: true } },
    },
    take: 100,
  });

  const tasksByProject = await readTaskStatesByProject(
    Array.from(new Set(entries.map((entry) => entry.project.id)))
  );

  return entries.map((entry) => {
    const liveTaskTitle = entry.taskId
      ? tasksByProject.get(entry.project.id)?.find((task) => task.id === entry.taskId)?.title
      : undefined;

    return {
      ...entry,
      taskTitle: liveTaskTitle ?? entry.taskTitle ?? null,
    };
  });
}

export async function getWorkTrackingOptions(includeProjectIds: string[] = []) {
  const user = await requireModuleAccess("PROJECT");
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });
  const includeIds = includeProjectIds.filter(Boolean);
  const activeOrIncludedWhere: Prisma.ProjectWhereInput =
    includeIds.length > 0
      ? {
          OR: [
            { status: { in: ACTIVE_PROJECT_STATUSES } },
            { id: { in: includeIds } },
          ],
        }
      : { status: { in: ACTIVE_PROJECT_STATUSES } };

  const projects = await db.project.findMany({
    where: mergeProjectWhere(projectWhere, activeOrIncludedWhere),
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      manager: {
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
        },
      },
      assignments: {
        where: { isActive: true },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  const tasksByProject = await readTaskStatesByProject(projects.map((project) => project.id));
  const employees = new Map<string, WorkTrackingEmployeeOption>();
  const isAdmin = user.role === "ADMIN";

  if (isAdmin) {
    const activeUsers = await db.user.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, role: true },
    });
    for (const employee of activeUsers) {
      employees.set(employee.id, employee);
    }
  } else {
    employees.set(user.id, { id: user.id, name: user.name ?? "Current user", role: user.role });
  }

  const projectOptions: WorkTrackingProjectOption[] = projects.map((project) => {
    const memberIds = new Set<string>();
    if (!isAdmin) {
      memberIds.add(user.id);
      return {
        id: project.id,
        name: project.name,
        code: project.code,
        memberIds: Array.from(memberIds),
      };
    }

    if (project.manager?.isActive) {
      memberIds.add(project.manager.id);
      employees.set(project.manager.id, {
        id: project.manager.id,
        name: project.manager.name,
        role: project.manager.role,
      });
    }

    for (const assignment of project.assignments) {
      if (!assignment.user.isActive) {
        continue;
      }
      memberIds.add(assignment.userId);
      employees.set(assignment.user.id, {
        id: assignment.user.id,
        name: assignment.user.name,
        role: assignment.user.role,
      });
    }

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      memberIds: Array.from(memberIds),
    };
  });

  const taskOptions: WorkTrackingTaskOption[] = projects.flatMap((project) => {
    const tasks = tasksByProject.get(project.id) ?? [];
    return tasks
      .filter((task) => canUseTaskForTimeEntry(task, user))
      .map((task) => ({
        id: task.id,
        title: task.title,
        projectId: project.id,
        projectName: project.name,
        projectCode: project.code,
        assigneeIds: isAdmin ? getTaskAssigneeIds(task) : [user.id],
        progress: typeof task.progress === "number" ? task.progress : 0,
      }));
  });

  return {
    projects: projectOptions,
    tasks: taskOptions,
    employees: Array.from(employees.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function getMyTimeEntries(userId: string, startDate?: Date, endDate?: Date) {
  const user = await requireModuleAccess("PROJECT");
  await ensureTimeEntrySchemaReady();

  const targetUserId = user.role === "ADMIN" ? userId : user.id;
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      project: projectWhere,
      ...(startDate && endDate && {
        date: { gte: startDate, lte: endDate },
      }),
    },
    orderBy: { date: "desc" },
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
  });
}

export async function getAssignedProjects(userId?: string) {
  const user = await requireModuleAccess("PROJECT");
  const targetUserId = user.role === "ADMIN" ? (userId ?? user.id) : user.id;
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.project.findMany({
    where: {
      ...projectWhere,
      status: { in: ACTIVE_PROJECT_STATUSES },
      assignments: { some: { userId: targetUserId, isActive: true } },
    },
    select: { id: true, name: true, code: true },
  });
}

export async function getAllActiveProjects() {
  const user = await requireModuleAccess("PROJECT");
  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  return db.project.findMany({
    where: {
      ...projectWhere,
      status: { in: ACTIVE_PROJECT_STATUSES },
    },
    select: { id: true, name: true, code: true },
  });
}

export async function createTimeEntry(formData: FormData) {
  const user = await requireActionPermission("CREATE", "PROJECT");
  await ensureTimeEntrySchemaReady();

  const validatedFields = createTimeEntrySchema.safeParse({
    employeeId: formData.get("employeeId") || undefined,
    projectId: formData.get("projectId"),
    taskId: formData.get("taskId"),
    date: formData.get("date"),
    hours: formData.get("hours"),
    description: formData.get("description") || undefined,
    isBillable: formData.get("isBillable") === "true",
    status: formData.get("status") || "DRAFT",
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  await requireProjectRecordAccess(validatedFields.data.projectId);

  const taskResult = await resolveProjectTaskForEntry(
    validatedFields.data.projectId,
    validatedFields.data.taskId,
    user
  );
  if ("error" in taskResult) {
    return { error: taskResult.error };
  }

  const employeeResult = await resolveTimeEntryEmployee({
    requestedEmployeeId: validatedFields.data.employeeId,
    projectId: validatedFields.data.projectId,
    task: taskResult.task,
    user,
  });
  if ("error" in employeeResult) {
    return { error: employeeResult.error };
  }

  const entry = await db.timeEntry.create({
    data: {
      userId: employeeResult.employee.id,
      projectId: validatedFields.data.projectId,
      taskId: taskResult.task.id,
      taskTitle: taskResult.task.title,
      date: validatedFields.data.date,
      hours: validatedFields.data.hours,
      description: validatedFields.data.description,
      isBillable: validatedFields.data.isBillable,
      status: validatedFields.data.status,
    },
  });

  await updateProjectActualHours(validatedFields.data.projectId);

  await logActivity({
    action: "CREATE",
    entityType: "time_entry",
    entityId: entry.id,
    userId: employeeResult.employee.id,
    createdById: user.id,
    metadata: {
      hours: entry.hours,
      projectId: entry.projectId,
      taskId: entry.taskId,
      taskTitle: entry.taskTitle,
      status: entry.status,
    },
  });

  revalidatePath("/work-tracking");
  revalidatePath(`/projects/${validatedFields.data.projectId}`);
  return { success: true, data: entry };
}

export async function updateTimeEntry(id: string, formData: FormData) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await ensureTimeEntrySchemaReady();

  const entry = await db.timeEntry.findUnique({ where: { id } });

  if (!entry) {
    return { error: "Time entry not found" };
  }

  await requireProjectRecordAccess(entry.projectId);

  if (entry.userId !== user.id && user.role !== "ADMIN") {
    return { error: "You can only edit your own time entries" };
  }

  const validatedFields = updateTimeEntrySchema.safeParse({
    employeeId: formData.get("employeeId") || undefined,
    projectId: formData.get("projectId") || undefined,
    taskId: formData.get("taskId") || undefined,
    date: formData.get("date") || undefined,
    hours: formData.get("hours") || undefined,
    description: formData.has("description") ? formData.get("description") : undefined,
    isBillable: formData.has("isBillable") ? formData.get("isBillable") === "true" : undefined,
    status: formData.get("status") || undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const nextProjectId = validatedFields.data.projectId ?? entry.projectId;
  const nextTaskId = validatedFields.data.taskId ?? entry.taskId;

  if (!nextTaskId) {
    return { error: "Task is required for time tracking." };
  }

  if (nextProjectId !== entry.projectId) {
    await requireProjectRecordAccess(nextProjectId);
  }

  const taskResult = await resolveProjectTaskForEntry(nextProjectId, nextTaskId, user);
  if ("error" in taskResult) {
    return { error: taskResult.error };
  }

  const employeeResult = await resolveTimeEntryEmployee({
    requestedEmployeeId: validatedFields.data.employeeId ?? entry.userId,
    projectId: nextProjectId,
    task: taskResult.task,
    user,
  });
  if ("error" in employeeResult) {
    return { error: employeeResult.error };
  }

  const updated = await db.timeEntry.update({
    where: { id },
    data: {
      ...validatedFields.data,
      userId: employeeResult.employee.id,
      projectId: nextProjectId,
      taskId: taskResult.task.id,
      taskTitle: taskResult.task.title,
    },
  });

  const projectsToUpdate = [entry.projectId];
  if (nextProjectId !== entry.projectId) {
    projectsToUpdate.push(nextProjectId);
  }

  for (const projectId of projectsToUpdate) {
    await updateProjectActualHours(projectId);
  }

  await logActivity({
    action: "UPDATE",
    entityType: "time_entry",
    entityId: id,
    userId: updated.userId,
    createdById: user.id,
    metadata: {
      changes: Object.keys(validatedFields.data),
      projectId: updated.projectId,
      taskId: updated.taskId,
      taskTitle: updated.taskTitle,
      status: updated.status,
    },
  });

  revalidatePath("/work-tracking");
  revalidatePath(`/projects/${entry.projectId}`);
  if (nextProjectId !== entry.projectId) {
    revalidatePath(`/projects/${nextProjectId}`);
  }
  return { success: true, data: updated };
}

export async function deleteTimeEntry(id: string) {
  const user = await requireAuth();
  await ensureTimeEntrySchemaReady();

  const entry = await db.timeEntry.findUnique({ where: { id } });

  if (!entry) {
    return { error: "Time entry not found" };
  }
  await requireActionPermission("DELETE", "PROJECT");
  await requireProjectRecordAccess(entry.projectId);

  if (entry.userId !== user.id && user.role !== "ADMIN") {
    return { error: "You can only delete your own time entries" };
  }

  await db.timeEntry.delete({ where: { id } });
  await updateProjectActualHours(entry.projectId);

  await logActivity({
    action: "DELETE",
    entityType: "time_entry",
    entityId: id,
    userId: entry.userId,
    createdById: user.id,
    metadata: {
      hours: entry.hours,
      projectId: entry.projectId,
      taskId: entry.taskId,
      taskTitle: entry.taskTitle,
    },
  });

  revalidatePath("/work-tracking");
  revalidatePath(`/projects/${entry.projectId}`);
  return { success: true };
}

export async function getWeeklyTimesheet(userId: string, weekStart: Date) {
  const user = await requireModuleAccess("PROJECT");
  await ensureTimeEntrySchemaReady();

  const targetUserId = user.role === "ADMIN" ? userId : user.id;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const entries = await db.timeEntry.findMany({
    where: {
      userId: targetUserId,
      date: { gte: weekStart, lte: weekEnd },
    },
    include: {
      project: { select: { id: true, name: true, code: true } },
    },
    orderBy: { date: "asc" },
  });

  const days: Record<string, typeof entries> = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    days[day.toISOString().split("T")[0]] = [];
  }

  for (const entry of entries) {
    const dateKey = new Date(entry.date).toISOString().split("T")[0];
    if (days[dateKey]) {
      days[dateKey].push(entry);
    }
  }

  return { entries, days };
}
