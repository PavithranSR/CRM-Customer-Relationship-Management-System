"use server";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAuth,
  requireProjectRecordAccess,
} from "@/lib/auth";
import type { ProjectTask, TaskPriorityLevel } from "@/lib/project-task-utils";
import { normalizeTask } from "@/lib/project-task-utils";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function isProjectTaskAssignableRole(role: string | null | undefined) {
  return role === "EMPLOYEE" || role === "TEAMLEADER";
}

function parseDueDateInput(value: FormDataEntryValue | null): {
  dueDate: string | null;
  hasInput: boolean;
  isValid: boolean;
} {
  if (value === null) {
    return { dueDate: null, hasInput: false, isValid: true };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { dueDate: null, hasInput: true, isValid: true };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { dueDate: null, hasInput: true, isValid: false };
  }

  return { dueDate: parsed.toISOString(), hasInput: true, isValid: true };
}

export interface ProjectTaskStage {
  id: string;
  name: string;
  sortOrder: number;
}

const DEFAULT_TASK_STAGES: ProjectTaskStage[] = [
  { id: "todo", name: "To Do", sortOrder: 0 },
  { id: "in_progress", name: "In Progress", sortOrder: 1 },
  { id: "done", name: "Done", sortOrder: 2 },
];

function getCompletionFromStage(stageId: string | undefined, stages: ProjectTaskStage[]) {
  if (stages.length <= 1) {
    return 0;
  }

  const fallbackStageId = stages[0]?.id ?? DEFAULT_TASK_STAGES[0].id;
  const resolvedStageId =
    stageId && stages.some((stage) => stage.id === stageId) ? stageId : fallbackStageId;
  const stageIndex = Math.max(
    0,
    stages.findIndex((stage) => stage.id === resolvedStageId)
  );
  return clampPercent(Math.round((stageIndex / (stages.length - 1)) * 100));
}

function withStageBasedProgress(tasks: ProjectTask[], stages: ProjectTaskStage[]) {
  return tasks.map((task) => ({
    ...task,
    progress: getCompletionFromStage(task.stageId, stages),
  }));
}

function shouldLimitTaskVisibilityForUser(input: {
  role: string;
  permissions: unknown;
}) {
  if (input.role === "ADMIN" || input.role === "BA") {
    return false;
  }

  const normalized = normalizeEmployeePermissions(input.permissions);
  const rules = normalized.recordRules;
  if (rules.includes("RECORD_RULES")) {
    return false;
  }

  const hasBroaderScope =
    rules.includes("TEAM_RECORD") || rules.includes("ASSIGN_PROJECT");

  return rules.includes("OWN_RECORD") && !hasBroaderScope;
}

function canUserSeeTask(task: ProjectTask, userId: string) {
  return (
    task.assigneeId === userId ||
    task.employeeAssigneeId === userId ||
    task.assignedTlId === userId
  );
}

function getCurrentTaskAssigneeId(task: Pick<ProjectTask, "assigneeId" | "employeeAssigneeId">) {
  if (task.employeeAssigneeId && task.employeeAssigneeId.length > 0) {
    return task.employeeAssigneeId;
  }

  const assigneeId = task.assigneeId.trim();
  return assigneeId.length > 0 ? assigneeId : undefined;
}

function canAssignEmployeeToAnyTask(user: { role: string }) {
  return user.role === "ADMIN" || user.role === "TEAMLEADER";
}

function getVisibleTasksForUser(input: {
  tasks: ProjectTask[];
  userId: string;
  role: string;
  permissions: unknown;
}) {
  if (!shouldLimitTaskVisibilityForUser(input)) {
    return input.tasks;
  }

  return input.tasks.filter((task) => canUserSeeTask(task, input.userId));
}

function buildVisibleTaskPayload(input: {
  tasks: ProjectTask[];
  stages: ProjectTaskStage[];
  userId: string;
  role: string;
  permissions: unknown;
}) {
  return {
    error: undefined as undefined,
    data: withStageBasedProgress(
      getVisibleTasksForUser({
        tasks: input.tasks,
        userId: input.userId,
        role: input.role,
        permissions: input.permissions,
      }),
      input.stages
    ),
    stages: input.stages,
  };
}

function taskActionError(
  error: string,
  options?: { data?: ProjectTask[]; stages?: ProjectTaskStage[] }
) {
  return {
    error,
    data: options?.data ?? ([] as ProjectTask[]),
    stages: options?.stages ?? DEFAULT_TASK_STAGES,
  };
}

async function getProjectAccess(projectId: string) {
  const user = await requireAuth();

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      type: true,
      managerId: true,
      assignments: {
        where: { isActive: true },
        select: { userId: true, user: { select: { role: true } } },
      },
    },
  });

  if (!project) {
    return { error: "Project not found" as const };
  }
  try {
    await requireProjectRecordAccess(projectId);
  } catch {
    return { error: "Forbidden" as const };
  }

  return { user, project };
}

async function readTaskState(projectId: string): Promise<{ tasks: ProjectTask[]; stages: ProjectTaskStage[] }> {
  const latest = await db.activityLog.findFirst({
    where: {
      entityType: "project_task_state",
      entityId: projectId,
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });

  const metadata =
    (latest?.metadata as { tasks?: ProjectTask[]; stages?: ProjectTaskStage[] } | null) ?? null;

  const tasks = Array.isArray(metadata?.tasks)
    ? metadata.tasks.map(normalizeTask).filter((task): task is ProjectTask => Boolean(task))
    : [];
  const stages =
    Array.isArray(metadata?.stages) && metadata.stages.length > 0
      ? metadata.stages
      : DEFAULT_TASK_STAGES;

  return { tasks, stages };
}

async function writeTaskState(
  projectId: string,
  createdById: string,
  state: { tasks: ProjectTask[]; stages: ProjectTaskStage[] }
) {
  const metadata = {
    tasks: state.tasks as unknown as Prisma.InputJsonValue,
    stages: state.stages as unknown as Prisma.InputJsonValue,
  } as Prisma.InputJsonValue;

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "project_task_state",
      entityId: projectId,
      projectId,
      createdById,
      metadata,
    },
  });
}

export async function getProjectTasks(projectId: string) {
  const access = await getProjectAccess(projectId);
  if ("error" in access) {
    return { error: access.error, data: [] as ProjectTask[], stages: DEFAULT_TASK_STAGES };
  }

  const state = await readTaskState(projectId);
  return buildVisibleTaskPayload({
    tasks: state.tasks,
    stages: state.stages,
    userId: access.user.id,
    role: access.user.role,
    permissions: access.user.permissions,
  });
}

export async function createProjectTask(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assigneeId = String(formData.get("assigneeId") || "").trim();
  const priorityInput = Number(formData.get("priority") || 1);
  const priority: TaskPriorityLevel = priorityInput === 2 || priorityInput === 3 ? priorityInput : 1;
  const dueDateInput = parseDueDateInput(formData.get("dueDate"));

  if (!projectId || !title) {
    return taskActionError("Project and title are required");
  }
  if (!dueDateInput.isValid) {
    return taskActionError("Invalid due date");
  }
  await requireActionPermission("CREATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user, project } = access;

  if (project.type !== "TEAM") {
    return taskActionError("Task split is allowed only for TEAM projects");
  }

  if (assigneeId) {
    if (canAssignEmployeeToAnyTask(user)) {
      const assignee = await db.user.findUnique({
        where: { id: assigneeId },
        select: { isActive: true, role: true },
      });
      if (!assignee || !assignee.isActive || assignee.role !== "EMPLOYEE") {
        return taskActionError("Assignee must be an active employee");
      }
    } else {
      const assignee = project.assignments.find((assignment) => assignment.userId === assigneeId);
      if (!assignee) {
        return taskActionError("Assignee must be from this project team");
      }

      if (!isProjectTaskAssignableRole(assignee.user.role)) {
        return taskActionError("Assignee must be a team leader or employee in this project");
      }
    }
  }

  const current = await readTaskState(projectId);
  const requestedStageId = String(formData.get("stageId") || "").trim();
  const stageId =
    requestedStageId && current.stages.some((stage) => stage.id === requestedStageId)
      ? requestedStageId
      : current.stages[0]?.id ?? DEFAULT_TASK_STAGES[0].id;

  const newTask: ProjectTask = {
    id: crypto.randomUUID(),
    title,
    description,
    assigneeId,
    assignedTlId: user.id,
    dueDate: dueDateInput.dueDate ?? undefined,
    priority,
    stageId,
    progress: getCompletionFromStage(stageId, current.stages),
    createdAt: new Date().toISOString(),
    updates: [],
    subtasks: [],
  };

  const next: ProjectTask[] = [newTask, ...current.tasks];

  await writeTaskState(projectId, user.id, { tasks: next, stages: current.stages });

  await db.activityLog.create({
    data: {
      action: "CREATE",
      entityType: "project_task",
      entityId: newTask.id,
      projectId,
      userId: assigneeId || null,
      createdById: user.id,
      metadata: {
        title: newTask.title,
        description: newTask.description,
        dueDate: newTask.dueDate ?? null,
        priority,
        assigneeId: assigneeId || null,
        stageId,
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: next,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function addProjectTaskDailyUpdate(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const comment = String(formData.get("comment") || "").trim();

  if (!projectId || !taskId) {
    return taskActionError("Project and task are required");
  }
  if (!comment) {
    return taskActionError("Daily comment is required");
  }
  await requireActionPermission("CREATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  if (user.role !== "EMPLOYEE") {
    return taskActionError("Only employee can submit daily task update");
  }

  const current = await readTaskState(projectId);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }
  const assignedEmployeeId = getCurrentTaskAssigneeId(task) ?? "";
  if (assignedEmployeeId !== user.id) {
    return taskActionError("You can update only your own tasks", {
      data: current.tasks,
      stages: current.stages,
    });
  }

  const updateId = crypto.randomUUID();
  const next = current.tasks.map((item) =>
    item.id === taskId
      ? {
          ...item,
          updates: [
            ...item.updates,
            {
              id: updateId,
              byUserId: user.id,
              comment,
              completedToday: 0,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      : item
  );

  await writeTaskState(projectId, user.id, { tasks: next, stages: current.stages });

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: user.id,
      createdById: user.id,
      metadata: {
        updateId,
        comment,
        completedToday: 0,
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: next,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function updateProjectTask(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const assigneeId = String(formData.get("assigneeId") || "").trim();
  const priorityInput = Number(formData.get("priority") || 1);
  const priority: TaskPriorityLevel = priorityInput === 2 || priorityInput === 3 ? priorityInput : 1;
  const dueDateInput = parseDueDateInput(formData.get("dueDate"));

  if (!projectId || !taskId || !title) {
    return taskActionError("Project, task, and title are required");
  }
  if (!dueDateInput.isValid) {
    return taskActionError("Invalid due date");
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user, project } = access;

  if (project.type !== "TEAM") {
    return taskActionError("Task split is allowed only for TEAM projects");
  }

  const current = await readTaskState(projectId);
  const existing = current.tasks.find((task) => task.id === taskId);
  if (!existing) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }
  const previousAssigneeId = getCurrentTaskAssigneeId(existing) ?? "";
  if (assigneeId && previousAssigneeId !== assigneeId) {
    if (canAssignEmployeeToAnyTask(user)) {
      const assignee = await db.user.findUnique({
        where: { id: assigneeId },
        select: { isActive: true, role: true },
      });
      if (!assignee || !assignee.isActive || assignee.role !== "EMPLOYEE") {
        return taskActionError("Assignee must be an active employee", {
          data: current.tasks,
          stages: current.stages,
        });
      }
    } else {
      const assignee = project.assignments.find(
        (assignment) => assignment.userId === assigneeId && isProjectTaskAssignableRole(assignment.user.role)
      );
      if (!assignee) {
        return taskActionError("Assignee must be a team leader or employee from this project team", {
          data: current.tasks,
          stages: current.stages,
        });
      }
    }
  }

  const requestedStageId = String(formData.get("stageId") || "");
  const stageId =
    requestedStageId && current.stages.some((stage) => stage.id === requestedStageId)
      ? requestedStageId
      : (existing.stageId ?? current.stages[0]?.id ?? DEFAULT_TASK_STAGES[0].id);

  const next: ProjectTask[] = current.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          title,
          description,
          assigneeId,
          dueDate: dueDateInput.hasInput
            ? dueDateInput.dueDate ?? undefined
            : task.dueDate,
          priority,
          stageId,
          progress: getCompletionFromStage(stageId, current.stages),
        }
      : task
  );

  await writeTaskState(projectId, user.id, { tasks: next, stages: current.stages });
  const nextDueDate = dueDateInput.hasInput ? dueDateInput.dueDate ?? null : existing.dueDate ?? null;

  const activityEntries: Array<Record<string, unknown>> = [];

  const previousStageId = existing.stageId ?? current.stages[0]?.id ?? DEFAULT_TASK_STAGES[0].id;
  if (previousStageId !== stageId) {
    activityEntries.push({
      actionType: "MOVE_STAGE",
      previousStageId,
      targetStageId: stageId,
      field: "Stage",
    });
  }

  if (previousAssigneeId !== assigneeId) {
    activityEntries.push({
      actionType: "REASSIGN",
      previousEmployeeAssigneeId: previousAssigneeId || null,
      newEmployeeAssigneeId: assigneeId || null,
      field: "Assignees",
    });
  }

  const previousPriority = existing.priority === 2 || existing.priority === 3 ? existing.priority : 1;
  if (previousPriority !== priority) {
    activityEntries.push({
      actionType: "CHANGE_PRIORITY",
      previousPriority,
      newPriority: priority,
      field: "Priority",
    });
  }

  const previousDueDate = existing.dueDate ?? null;
  if (previousDueDate !== nextDueDate) {
    activityEntries.push({
      actionType: "CHANGE_DEADLINE",
      previousDueDate,
      newDueDate: nextDueDate,
      field: "Deadline",
    });
  }

  if (existing.title !== title) {
    activityEntries.push({
      actionType: "CHANGE_TITLE",
      previousTitle: existing.title,
      newTitle: title,
      field: "Title",
    });
  }

  if ((existing.description ?? "") !== description) {
    activityEntries.push({
      actionType: "CHANGE_DESCRIPTION",
      previousDescription: existing.description ?? "",
      newDescription: description,
      field: "Description",
    });
  }

  if (activityEntries.length === 0) {
    activityEntries.push({
      actionType: "EDIT",
      field: "Task",
    });
  }

  await db.activityLog.createMany({
    data: activityEntries.map((metadata) => ({
      action: "UPDATE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: assigneeId || null,
      createdById: user.id,
      metadata: metadata as Prisma.InputJsonValue,
    })),
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: next,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function addProjectTaskSubtask(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const title = String(formData.get("title") || "").trim();
  const assigneeId = String(formData.get("assigneeId") || "").trim();

  if (!projectId || !taskId || !title) {
    return taskActionError("Project, task, and sub-task title are required");
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user, project } = access;

  const current = await readTaskState(projectId);
  const existing = current.tasks.find((task) => task.id === taskId);
  if (!existing) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }

  if (assigneeId) {
    const assignee = project.assignments.find(
      (assignment) => assignment.userId === assigneeId && isProjectTaskAssignableRole(assignment.user.role)
    );
    if (!assignee) {
      return taskActionError("Sub-task assignee must be a project team member", {
        data: current.tasks,
        stages: current.stages,
      });
    }
  }

  const newSubtask = {
    id: crypto.randomUUID(),
    title,
    assigneeId: assigneeId || undefined,
    createdAt: new Date().toISOString(),
  };

  const next = current.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          subtasks: [...(task.subtasks ?? []), newSubtask],
        }
      : task
  );

  await writeTaskState(projectId, user.id, { tasks: next, stages: current.stages });

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: assigneeId || getCurrentTaskAssigneeId(existing) || null,
      createdById: user.id,
      metadata: {
        actionType: "ADD_SUBTASK",
        field: "Sub-task",
        subtaskId: newSubtask.id,
        subtaskTitle: newSubtask.title,
        subtaskAssigneeId: newSubtask.assigneeId ?? null,
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: next,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function deleteProjectTask(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");

  if (!projectId || !taskId) {
    return taskActionError("Project and task are required");
  }
  await requireActionPermission("DELETE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user, project } = access;

  if (project.type !== "TEAM") {
    return taskActionError("Task split is allowed only for TEAM projects");
  }

  const current = await readTaskState(projectId);
  const existing = current.tasks.find((task) => task.id === taskId);
  if (!existing) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }

  const next = current.tasks.filter((task) => task.id !== taskId);
  await writeTaskState(projectId, user.id, { tasks: next, stages: current.stages });
  const effectiveAssigneeId = getCurrentTaskAssigneeId(existing);

  await db.activityLog.create({
    data: {
      action: "DELETE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: effectiveAssigneeId ?? null,
      createdById: user.id,
      metadata: {
        title: existing.title,
        assigneeId: effectiveAssigneeId ?? null,
        actionType: "DELETE",
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: next,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function createProjectTaskStage(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!projectId || !name) return taskActionError("Project and stage name are required");
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  const current = await readTaskState(projectId);
  const exists = current.stages.some((stage) => stage.name.toLowerCase() === name.toLowerCase());
  if (exists) return taskActionError("Stage already exists", { data: current.tasks, stages: current.stages });

  const nextStages = [
    ...current.stages,
    {
      id: crypto.randomUUID(),
      name,
      sortOrder: current.stages.length,
    },
  ];

  await writeTaskState(projectId, user.id, { tasks: current.tasks, stages: nextStages });
  return { success: true, error: undefined, stages: nextStages, data: current.tasks };
}

export async function deleteProjectTaskStage(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const stageId = String(formData.get("stageId") || "");
  if (!projectId || !stageId) return taskActionError("Project and stage are required");
  await requireActionPermission("DELETE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  const current = await readTaskState(projectId);
  if (current.stages.length <= 1) {
    return taskActionError("At least one stage must remain", { data: current.tasks, stages: current.stages });
  }
  if (!current.stages.some((stage) => stage.id === stageId)) {
    return taskActionError("Stage not found", { data: current.tasks, stages: current.stages });
  }

  const nextStages = current.stages
    .filter((stage) => stage.id !== stageId)
    .map((stage, index) => ({ ...stage, sortOrder: index }));

  const fallbackStageId = nextStages[0].id;
  const nextTasks = withStageBasedProgress(
    current.tasks.map((task) =>
      task.stageId === stageId
        ? { ...task, stageId: fallbackStageId }
        : task
    ),
    nextStages
  );

  await writeTaskState(projectId, user.id, { tasks: nextTasks, stages: nextStages });
  return { success: true, error: undefined, stages: nextStages, data: nextTasks };
}

export async function renameProjectTaskStage(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const stageId = String(formData.get("stageId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!projectId || !stageId || !name) {
    return taskActionError("Project, stage, and name are required");
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  const current = await readTaskState(projectId);
  if (!current.stages.some((stage) => stage.id === stageId)) {
    return taskActionError("Stage not found", { data: current.tasks, stages: current.stages });
  }

  const duplicate = current.stages.some(
    (stage) => stage.id !== stageId && stage.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return taskActionError("Stage name already exists", { data: current.tasks, stages: current.stages });
  }

  const nextStages = current.stages.map((stage) =>
    stage.id === stageId ? { ...stage, name } : stage
  );

  await writeTaskState(projectId, user.id, { tasks: current.tasks, stages: nextStages });
  return { success: true, error: undefined, stages: nextStages, data: current.tasks };
}

export async function moveOwnProjectTaskStage(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const targetStageId = String(formData.get("targetStageId") || "");

  if (!projectId || !taskId || !targetStageId) {
    return taskActionError("Project, task, and target stage are required");
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  if (user.role !== "EMPLOYEE" && user.role !== "TEAMLEADER") {
    return taskActionError("Only assigned employee or team leader can move task stages");
  }

  const current = await readTaskState(projectId);
  const task = current.tasks.find((item) => item.id === taskId);
  if (!task) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }
  const assignedEmployeeId = getCurrentTaskAssigneeId(task) ?? "";
  if (assignedEmployeeId !== user.id) {
    return taskActionError("You can move only your own tasks", {
      data: current.tasks,
      stages: current.stages,
    });
  }

  const targetStage = current.stages.find((stage) => stage.id === targetStageId);
  if (!targetStage) {
    return taskActionError("Target stage not found", { data: current.tasks, stages: current.stages });
  }

  const previousStageId = task.stageId ?? current.stages[0]?.id ?? DEFAULT_TASK_STAGES[0].id;
  if (previousStageId === targetStageId) {
  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: current.tasks,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

  const targetProgress = getCompletionFromStage(targetStageId, current.stages);
  const nextTasks = current.tasks.map((item) =>
    item.id === taskId
      ? {
          ...item,
          stageId: targetStageId,
          progress: targetProgress,
        }
      : item
  );

  await writeTaskState(projectId, user.id, { tasks: nextTasks, stages: current.stages });

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: user.id,
      createdById: user.id,
      metadata: {
        actionType: "MOVE_STAGE",
        previousStageId,
        targetStageId,
        progress: targetProgress,
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: nextTasks,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function reassignProjectTask(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const employeeId = String(formData.get("employeeId") || "");

  if (!projectId || !taskId || !employeeId) {
    return taskActionError("Project, task, and employee are required");
  }
  await requireActionPermission("UPDATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return taskActionError(String(access.error));
  const { user } = access;

  const current = await readTaskState(projectId);
  const existing = current.tasks.find((task) => task.id === taskId);
  if (!existing) {
    return taskActionError("Task not found", { data: current.tasks, stages: current.stages });
  }
  if (!canAssignEmployeeToAnyTask(user)) {
    return taskActionError("Only admin or team leader can assign employees to this task", {
      data: current.tasks,
      stages: current.stages,
    });
  }
  const targetAssignee = await db.user.findUnique({
    where: { id: employeeId },
    select: { isActive: true, role: true },
  });
  if (!targetAssignee || !targetAssignee.isActive || targetAssignee.role !== "EMPLOYEE") {
    return taskActionError("Assignee must be an active employee", {
      data: current.tasks,
      stages: current.stages,
    });
  }

  const nextTasks = current.tasks.map((task) =>
    task.id === taskId
      ? {
          ...task,
          assignedTlId: user.id,
          employeeAssigneeId: employeeId,
        }
      : task
  );

  await writeTaskState(projectId, user.id, { tasks: nextTasks, stages: current.stages });

  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType: "project_task",
      entityId: taskId,
      projectId,
      userId: employeeId,
      createdById: user.id,
      metadata: {
        actionType: "REASSIGN",
        taskOwnerId: getCurrentTaskAssigneeId(existing) ?? null,
        previousEmployeeAssigneeId: existing.employeeAssigneeId ?? null,
        newEmployeeAssigneeId: employeeId,
      },
    },
  });

  return {
    success: true,
    ...buildVisibleTaskPayload({
      tasks: nextTasks,
      stages: current.stages,
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
    }),
  };
}

export async function createProjectTaskStageByAdmin(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const name = String(formData.get("name") || "").trim();

  if (!projectId || !name) {
    return { error: "Project and stage name are required" };
  }
  await requireActionPermission("CREATE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return { error: access.error };
  const { user } = access;

  if (user.role !== "ADMIN") {
    return { error: "Only admin can add task stages here" };
  }

  const current = await readTaskState(projectId);
  const exists = current.stages.some((stage) => stage.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    return { error: "Stage already exists" };
  }

  const nextStages = [
    ...current.stages,
    {
      id: crypto.randomUUID(),
      name,
      sortOrder: current.stages.length,
    },
  ];

  await writeTaskState(projectId, user.id, { tasks: current.tasks, stages: nextStages });
  return { success: true, error: undefined, stages: nextStages, data: current.tasks };
}

export async function deleteProjectTaskStageByAdmin(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const stageId = String(formData.get("stageId") || "");

  if (!projectId || !stageId) {
    return { error: "Project and stage are required" };
  }
  await requireActionPermission("DELETE", "PROJECT");

  const access = await getProjectAccess(projectId);
  if ("error" in access) return { error: access.error };
  const { user } = access;

  if (user.role !== "ADMIN") {
    return { error: "Only admin can delete task stages here" };
  }

  const current = await readTaskState(projectId);
  if (current.stages.length <= 1) {
    return { error: "At least one stage must remain" };
  }
  if (!current.stages.some((stage) => stage.id === stageId)) {
    return { error: "Stage not found" };
  }

  const nextStages = current.stages
    .filter((stage) => stage.id !== stageId)
    .map((stage, index) => ({ ...stage, sortOrder: index }));

  const deletedStageWasDefault = stageId === current.stages[0]?.id;
  const fallbackStageId = nextStages[0]?.id ?? DEFAULT_TASK_STAGES[0].id;
  const nextTasks = withStageBasedProgress(
    current.tasks.map((task) => {
      const taskInDeletedStage =
        task.stageId === stageId || (!task.stageId && deletedStageWasDefault);

      return taskInDeletedStage
        ? {
            ...task,
            stageId: fallbackStageId,
          }
        : task;
    }),
    nextStages
  );

  await writeTaskState(projectId, user.id, { tasks: nextTasks, stages: nextStages });
  return { success: true, error: undefined, stages: nextStages, data: nextTasks };
}
