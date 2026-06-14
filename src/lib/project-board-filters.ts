import { Priority, ProjectStatus, ProjectType } from "@prisma/client";

export type ProjectFilterKey =
  | "all"
  | "active"
  | "completed"
  | "team"
  | "individual"
  | "high_priority";

export interface ProjectFilterableItem {
  name: string;
  code: string;
  quotationNo?: string | null;
  sourceTitle?: string | null;
  serviceName?: string | null;
  projectCategory?: string | null;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  manager: { name: string } | null;
  managerName?: string | null;
  stageName?: string | null;
  stageSortOrder?: number | null;
  deadline: Date | null;
}

export interface ProjectAdvancedFilters {
  projectCategories: string[];
  statuses: ProjectStatus[];
  priorities: Priority[];
  managers: string[];
  stages: string[];
  dueState: TaskDueStateKey;
}

export type TaskBoardStatus = string;
export type TaskBoardPriorityLevel = 1 | 2 | 3;
export type TaskDueStateKey = "all" | "overdue" | "due_this_week" | "no_due_date";

export interface TaskAdvancedFilters {
  projectCategories: string[];
  statuses: TaskBoardStatus[];
  priorities: TaskBoardPriorityLevel[];
  assignees: string[];
  stages: string[];
  dueState: TaskDueStateKey;
}

export interface TaskBoardFilterableItem {
  title: string;
  description?: string | null;
  projectName: string;
  projectCategory?: string | null;
  assigneeName: string;
  stageName: string;
  projectType: ProjectType;
  managerName?: string | null;
  dueDate?: string | Date | null;
  priorityLevel: TaskBoardPriorityLevel;
  taskStatus: TaskBoardStatus;
}

export type ProjectGroupByKey =
  | "none"
  | "status"
  | "priority"
  | "assignee"
  | "stage"
  | "manager"
  | "deadline"
  | "category";

export function createDefaultTaskAdvancedFilters(): TaskAdvancedFilters {
  return {
    projectCategories: [],
    statuses: [],
    priorities: [],
    assignees: [],
    stages: [],
    dueState: "all",
  };
}

export function createDefaultProjectAdvancedFilters(): ProjectAdvancedFilters {
  return {
    projectCategories: [],
    statuses: [],
    priorities: [],
    managers: [],
    stages: [],
    dueState: "all",
  };
}

export function normalizeProjectCategory(value?: string | null) {
  return value?.trim() || "Uncategorized";
}

function matchesTaskDueState(
  task: Pick<TaskBoardFilterableItem, "dueDate" | "taskStatus">,
  dueState: TaskDueStateKey
) {
  if (dueState === "all") {
    return true;
  }

  if (!task.dueDate) {
    return dueState === "no_due_date";
  }

  const dueDate = new Date(task.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (dueState === "overdue") {
    return dueDate.getTime() < startOfToday.getTime() && task.taskStatus !== "DONE";
  }

  if (dueState === "due_this_week") {
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + 7);
    return dueDate.getTime() >= startOfToday.getTime() && dueDate.getTime() <= endOfWindow.getTime();
  }

  return false;
}

function matchesProjectDueState(
  project: Pick<ProjectFilterableItem, "deadline">,
  dueState: TaskDueStateKey
) {
  if (dueState === "all") {
    return true;
  }

  if (!project.deadline) {
    return dueState === "no_due_date";
  }

  const deadline = new Date(project.deadline);
  if (Number.isNaN(deadline.getTime())) {
    return false;
  }

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (dueState === "overdue") {
    return deadline.getTime() < startOfToday.getTime();
  }

  if (dueState === "due_this_week") {
    const endOfWindow = new Date(startOfToday);
    endOfWindow.setDate(endOfWindow.getDate() + 7);
    return deadline.getTime() >= startOfToday.getTime() && deadline.getTime() <= endOfWindow.getTime();
  }

  return false;
}

function getTaskStatusSortWeight(status: string) {
  if (status === "TODO") return 0;
  if (status === "IN_PROGRESS") return 1;
  if (status === "DONE") return 2;
  return 3;
}

function getTaskStageSortWeight(stageName: string) {
  const normalized = stageName.trim().toLowerCase();
  if (normalized === "to do" || normalized === "todo") return 0;
  if (normalized === "in progress" || normalized === "in_progress") return 1;
  if (normalized === "done") return 2;
  return 3;
}

export function applyProjectBoardFilters<T extends ProjectFilterableItem>(
  projects: T[],
  searchQuery: string,
  activeFilter: ProjectFilterKey,
  activeGroupBy: ProjectGroupByKey,
  advancedFilters?: ProjectAdvancedFilters
) {
  const q = searchQuery.trim().toLowerCase();

  let next = projects.filter((project) => {
    const text = [
      project.name,
      project.code,
      project.quotationNo || "",
      project.sourceTitle || "",
      normalizeProjectCategory(project.projectCategory ?? project.serviceName),
      project.stageName || "",
      project.managerName || "",
      project.manager?.name || "",
      project.type,
      project.priority,
      project.status,
    ]
      .join(" ")
      .toLowerCase();
    return !q || text.includes(q);
  });

  next = next.filter((project) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") {
      return project.status !== "COMPLETED" && project.status !== "CANCELLED";
    }
    if (activeFilter === "completed") return project.status === "COMPLETED";
    if (activeFilter === "team") return project.type === "TEAM";
    if (activeFilter === "individual") return project.type === "INDIVIDUAL";
    if (activeFilter === "high_priority") {
      return project.priority === "HIGH" || project.priority === "CRITICAL";
    }
    return true;
  });

  if (advancedFilters) {
    next = next.filter((project) => {
      const resolvedCategory = normalizeProjectCategory(project.projectCategory ?? project.serviceName);
      const normalizedManager = project.managerName?.trim() || project.manager?.name?.trim() || "Unassigned";
      const normalizedStage = project.stageName?.trim() || "Unassigned";

      if (
        advancedFilters.projectCategories.length > 0 &&
        !advancedFilters.projectCategories.includes(resolvedCategory)
      ) {
        return false;
      }

      if (advancedFilters.statuses.length > 0 && !advancedFilters.statuses.includes(project.status)) {
        return false;
      }

      if (advancedFilters.priorities.length > 0 && !advancedFilters.priorities.includes(project.priority)) {
        return false;
      }

      if (advancedFilters.managers.length > 0 && !advancedFilters.managers.includes(normalizedManager)) {
        return false;
      }

      if (advancedFilters.stages.length > 0 && !advancedFilters.stages.includes(normalizedStage)) {
        return false;
      }

      return matchesProjectDueState(project, advancedFilters.dueState);
    });
  }

  if (activeGroupBy === "none") {
    return next;
  }

  const sorted = [...next];
  sorted.sort((a, b) => {
    if (activeGroupBy === "status") {
      const statusOrder: Record<ProjectStatus, number> = {
        PLANNING: 0,
        IN_PROGRESS: 1,
        ON_HOLD: 2,
        COMPLETED: 3,
        CANCELLED: 4,
      };
      return statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "priority") {
      const priorityOrder: Record<Priority, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "manager") {
      return (a.managerName || a.manager?.name || "Unassigned").localeCompare(
        b.managerName || b.manager?.name || "Unassigned"
      ) || a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "assignee") {
      return a.name.localeCompare(b.name);
    }

    if (activeGroupBy === "stage") {
      const leftOrder = a.stageSortOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = b.stageSortOrder ?? Number.MAX_SAFE_INTEGER;
      return (
        leftOrder - rightOrder ||
        (a.stageName || "Unassigned").localeCompare(b.stageName || "Unassigned") ||
        a.name.localeCompare(b.name)
      );
    }

    if (activeGroupBy === "category") {
      return normalizeProjectCategory(a.projectCategory ?? a.serviceName).localeCompare(
        normalizeProjectCategory(b.projectCategory ?? b.serviceName)
      )
        || a.name.localeCompare(b.name);
    }

    const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.name.localeCompare(b.name);
  });

  return sorted;
}

export function applyProjectTaskBoardFilters<T extends TaskBoardFilterableItem>(
  tasks: T[],
  searchQuery: string,
  activeFilter: ProjectFilterKey,
  activeGroupBy: ProjectGroupByKey,
  advancedFilters?: TaskAdvancedFilters
) {
  const q = searchQuery.trim().toLowerCase();

  let next = tasks.filter((task) => {
    const text = [
      task.title,
      task.description || "",
      task.projectName,
      normalizeProjectCategory(task.projectCategory),
      task.assigneeName,
      task.managerName || "",
      task.stageName,
      task.taskStatus,
      task.projectType,
    ]
      .join(" ")
      .toLowerCase();

    return !q || text.includes(q);
  });

  next = next.filter((task) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "active") return task.taskStatus !== "DONE";
    if (activeFilter === "completed") return task.taskStatus === "DONE";
    if (activeFilter === "team") return task.projectType === "TEAM";
    if (activeFilter === "individual") return task.projectType === "INDIVIDUAL";
    if (activeFilter === "high_priority") return task.priorityLevel >= 2;
    return true;
  });

  if (advancedFilters) {
    next = next.filter((task) => {
      const normalizedCategory = normalizeProjectCategory(task.projectCategory);
      const normalizedAssignee = task.assigneeName.trim() || "Unassigned";
      const normalizedStage = task.stageName.trim() || "To Do";

      if (
        advancedFilters.projectCategories.length > 0 &&
        !advancedFilters.projectCategories.includes(normalizedCategory)
      ) {
        return false;
      }

      if (advancedFilters.statuses.length > 0 && !advancedFilters.statuses.includes(task.taskStatus)) {
        return false;
      }

      if (
        advancedFilters.priorities.length > 0 &&
        !advancedFilters.priorities.includes(task.priorityLevel)
      ) {
        return false;
      }

      if (advancedFilters.assignees.length > 0 && !advancedFilters.assignees.includes(normalizedAssignee)) {
        return false;
      }

      if (advancedFilters.stages.length > 0 && !advancedFilters.stages.includes(normalizedStage)) {
        return false;
      }

      return matchesTaskDueState(task, advancedFilters.dueState);
    });
  }

  if (activeGroupBy === "none") {
    return next;
  }

  const sorted = [...next];
  sorted.sort((a, b) => {
    if (activeGroupBy === "status") {
      return (
        getTaskStatusSortWeight(a.taskStatus) - getTaskStatusSortWeight(b.taskStatus) ||
        a.taskStatus.localeCompare(b.taskStatus) ||
        a.title.localeCompare(b.title)
      );
    }

    if (activeGroupBy === "priority") {
      const priorityOrder: Record<TaskBoardPriorityLevel, number> = {
        3: 0,
        2: 1,
        1: 2,
      };

      return priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel] || a.title.localeCompare(b.title);
    }

    if (activeGroupBy === "assignee") {
      return (a.assigneeName || "Unassigned").localeCompare(b.assigneeName || "Unassigned")
        || a.title.localeCompare(b.title);
    }

    if (activeGroupBy === "stage") {
      return (
        getTaskStageSortWeight(a.stageName || "To Do") - getTaskStageSortWeight(b.stageName || "To Do") ||
        (a.stageName || "To Do").localeCompare(b.stageName || "To Do") ||
        a.title.localeCompare(b.title)
      );
    }

    if (activeGroupBy === "manager") {
      return (a.managerName || a.assigneeName || "Unassigned").localeCompare(
        b.managerName || b.assigneeName || "Unassigned"
      );
    }

    if (activeGroupBy === "category") {
      return normalizeProjectCategory(a.projectCategory).localeCompare(normalizeProjectCategory(b.projectCategory))
        || a.title.localeCompare(b.title);
    }

    const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.title.localeCompare(b.title);
  });

  return sorted;
}
