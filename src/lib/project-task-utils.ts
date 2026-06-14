export interface TaskUpdate {
  id: string;
  byUserId: string;
  comment: string;
  completedToday: number;
  createdAt: string;
}

export type TaskPriorityLevel = 1 | 2 | 3;

export interface TaskSubtask {
  id: string;
  title: string;
  assigneeId?: string;
  createdAt: string;
}

export type DefaultTaskStageKey = "todo" | "in_progress" | "done";

export const DEFAULT_TASK_STAGE_OPTIONS: Array<{ id: DefaultTaskStageKey; name: string }> = [
  { id: "todo", name: "To Do" },
  { id: "in_progress", name: "In Progress" },
  { id: "done", name: "Done" },
];

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assignedTlId?: string;
  employeeAssigneeId?: string;
  dueDate?: string;
  priority?: TaskPriorityLevel;
  stageId?: string;
  progress?: number;
  createdAt: string;
  updates: TaskUpdate[];
  subtasks?: TaskSubtask[];
}

export function getTaskCompletionPercent(task: Pick<ProjectTask, "progress">): number {
  if (typeof task.progress === "number") {
    return Math.max(0, Math.min(100, task.progress));
  }
  return 0;
}

export function getTaskStatus(task: Pick<ProjectTask, "progress">): "TODO" | "IN_PROGRESS" | "DONE" {
  const percent = getTaskCompletionPercent(task);
  if (percent >= 100) return "DONE";
  if (percent > 0) return "IN_PROGRESS";
  return "TODO";
}

export function getTaskStageKey(task: Pick<ProjectTask, "progress">): DefaultTaskStageKey {
  const status = getTaskStatus(task);
  if (status === "DONE") return "done";
  if (status === "IN_PROGRESS") return "in_progress";
  return "todo";
}

export function getTaskStageLabel(task: Pick<ProjectTask, "progress">) {
  const stageKey = getTaskStageKey(task);
  return DEFAULT_TASK_STAGE_OPTIONS.find((stage) => stage.id === stageKey)?.name ?? "To Do";
}

export function getTaskPriorityLevel(task: Pick<ProjectTask, "priority">): TaskPriorityLevel {
  if (task.priority === 2 || task.priority === 3) {
    return task.priority;
  }
  return 1;
}

export function getTaskPriorityLabel(task: Pick<ProjectTask, "priority">): "MEDIUM" | "HIGH" | "URGENT" {
  const level = getTaskPriorityLevel(task);
  if (level === 3) return "URGENT";
  if (level === 2) return "HIGH";
  return "MEDIUM";
}

export function normalizeTask(raw: unknown): ProjectTask | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;

  const id = typeof value.id === "string" ? value.id : "";
  const title = typeof value.title === "string" ? value.title : "";
  const description = typeof value.description === "string" ? value.description : "";
  const assigneeId = typeof value.assigneeId === "string" ? value.assigneeId : "";
  const assignedTlId = typeof value.assignedTlId === "string" ? value.assignedTlId : undefined;
  const employeeAssigneeId =
    typeof value.employeeAssigneeId === "string" ? value.employeeAssigneeId : undefined;
  const dueDate = typeof value.dueDate === "string" ? value.dueDate : undefined;
  const priority =
    value.priority === 2 || value.priority === 3
      ? value.priority
      : value.priority === 1
        ? 1
        : typeof value.priority === "string"
          ? Math.max(1, Math.min(3, Number(value.priority))) as TaskPriorityLevel
          : 1;
  const stageId = typeof value.stageId === "string" ? value.stageId : undefined;
  const rawProgress =
    typeof value.progress === "number"
      ? Math.max(0, Math.min(100, value.progress))
      : typeof value.progress === "string"
        ? Math.max(0, Math.min(100, Number(value.progress)))
        : undefined;
  const progress = typeof rawProgress === "number" && !Number.isNaN(rawProgress) ? rawProgress : undefined;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();

  if (!id || !title) return null;

  const updatesRaw = Array.isArray(value.updates) ? value.updates : [];
  const updates: TaskUpdate[] = updatesRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const u = item as Record<string, unknown>;
      const updateId = typeof u.id === "string" ? u.id : "";
      const byUserId = typeof u.byUserId === "string" ? u.byUserId : "";
      const comment = typeof u.comment === "string" ? u.comment : "";
      const completedToday =
        typeof u.completedToday === "number"
          ? u.completedToday
          : typeof u.completedToday === "string"
            ? Number(u.completedToday)
            : 0;
      const updateCreatedAt =
        typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString();

      if (!updateId || !byUserId || Number.isNaN(completedToday)) return null;
      return {
        id: updateId,
        byUserId,
        comment,
        completedToday: Math.max(0, Math.min(100, completedToday)),
        createdAt: updateCreatedAt,
      };
    })
    .filter((item): item is TaskUpdate => Boolean(item));

  const subtasksRaw = Array.isArray(value.subtasks) ? value.subtasks : [];
  const subtasks: TaskSubtask[] = subtasksRaw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const subtask = item as Record<string, unknown>;
      const subtaskId = typeof subtask.id === "string" ? subtask.id : "";
      const subtaskTitle = typeof subtask.title === "string" ? subtask.title : "";
      const subtaskAssigneeId =
        typeof subtask.assigneeId === "string" && subtask.assigneeId.length > 0
          ? subtask.assigneeId
          : undefined;
      const subtaskCreatedAt =
        typeof subtask.createdAt === "string" ? subtask.createdAt : new Date().toISOString();

      if (!subtaskId || !subtaskTitle) return [];
      return [{
        id: subtaskId,
        title: subtaskTitle,
        assigneeId: subtaskAssigneeId,
        createdAt: subtaskCreatedAt,
      }];
    });

  return {
    id,
    title,
    description,
    assigneeId,
    assignedTlId,
    employeeAssigneeId,
    dueDate,
    priority,
    stageId,
    progress,
    createdAt,
    updates,
    subtasks,
  };
}
