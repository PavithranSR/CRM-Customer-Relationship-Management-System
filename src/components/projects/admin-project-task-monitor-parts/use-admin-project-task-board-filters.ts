"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ProjectType } from "@prisma/client";
import {
  ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY,
  type TaskStageItem,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import {
  applyProjectTaskBoardFilters,
  createDefaultTaskAdvancedFilters,
  normalizeProjectCategory,
  type ProjectFilterKey,
  type ProjectGroupByKey,
  type TaskAdvancedFilters,
} from "@/lib/project-board-filters";
import {
  getTaskCompletionPercent,
  getTaskPriorityLevel,
  getTaskStatus,
  type ProjectTask,
} from "@/lib/project-task-utils";

interface UseAdminProjectTaskBoardFiltersProps {
  peopleMap: Map<string, TeamPerson>;
  projectCategory?: string | null;
  projectManagerName?: string | null;
  projectName?: string;
  projectTags?: string | null;
  projectType: ProjectType;
  stages: TaskStageItem[];
  tasks: ProjectTask[];
}

function getStoredFoldedStages() {
  if (typeof window === "undefined") {
    return {};
  }

  const storedValue = window.localStorage.getItem(ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY);
  if (!storedValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"
      )
    );
  } catch {
    window.localStorage.removeItem(ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY);
    return {};
  }
}

export function useAdminProjectTaskBoardFilters({
  peopleMap,
  projectCategory,
  projectManagerName,
  projectName,
  projectTags,
  projectType,
  stages,
  tasks,
}: UseAdminProjectTaskBoardFiltersProps) {
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [boardSearch, setBoardSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ProjectFilterKey>("all");
  const [activeGroupBy, setActiveGroupBy] = useState<ProjectGroupByKey>("none");
  const [taskAdvancedFilters, setTaskAdvancedFilters] = useState<TaskAdvancedFilters>(
    createDefaultTaskAdvancedFilters
  );
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [foldedStages, setFoldedStages] = useState<Record<string, boolean>>(getStoredFoldedStages);
  const deferredBoardSearch = useDeferredValue(boardSearch);

  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};

    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of tasks) {
      const assignedStageId = task.stageId && initial[task.stageId] ? task.stageId : stages[0]?.id;
      if (!assignedStageId) continue;
      initial[assignedStageId].push(task);
    }

    return initial;
  }, [stages, tasks]);

  const getStageName = useCallback(
    (task: ProjectTask) => stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do",
    [stages]
  );

  const getResponsibleName = useCallback(
    (task: ProjectTask) => {
      if (task.employeeAssigneeId && peopleMap.has(task.employeeAssigneeId)) {
        return peopleMap.get(task.employeeAssigneeId)?.name ?? "Unknown";
      }
      if (task.assigneeId) {
        return peopleMap.get(task.assigneeId)?.name ?? "Unknown";
      }
      return "Unassigned";
    },
    [peopleMap]
  );

  const getTaskAssigneePerson = useCallback(
    (task: ProjectTask) => {
      const assigneeId = task.employeeAssigneeId || task.assigneeId;

      if (!assigneeId) {
        return null;
      }

      return peopleMap.get(assigneeId) ?? null;
    },
    [peopleMap]
  );

  const resolvedProjectCategory = useMemo(() => {
    const firstTag = projectTags
      ?.split(",")
      .map((item) => item.trim())
      .find(Boolean);

    return normalizeProjectCategory(
      projectCategory?.trim() ||
        firstTag ||
        (projectType === "TEAM" ? "Team Project" : "Individual Project")
    );
  }, [projectCategory, projectTags, projectType]);

  const boardFilterableTasks = useMemo(
    () =>
      tasks.map((task) => {
        const fallbackStageId = stages[0]?.id;
        const effectiveStageId =
          task.stageId && stages.some((stage) => stage.id === task.stageId) ? task.stageId : fallbackStageId;
        const resolvedStageName =
          stages.find((stage) => stage.id === effectiveStageId)?.name ?? stages[0]?.name ?? "To Do";

        return {
          task,
          title: task.title,
          description: task.description,
          projectName: projectName?.trim() || "Current Project Task",
          projectCategory: resolvedProjectCategory,
          assigneeName: getResponsibleName(task).trim() || "Unassigned",
          stageName: resolvedStageName,
          projectType,
          managerName: projectManagerName?.trim() || null,
          dueDate: task.dueDate,
          priorityLevel: getTaskPriorityLevel(task),
          taskStatus: getTaskStatus(task),
        };
      }),
    [getResponsibleName, projectManagerName, projectName, projectType, resolvedProjectCategory, stages, tasks]
  );

  const filteredBoardTasks = useMemo(
    () =>
      applyProjectTaskBoardFilters(
        boardFilterableTasks,
        deferredBoardSearch,
        activeFilter,
        activeGroupBy,
        taskAdvancedFilters
      ),
    [activeFilter, activeGroupBy, boardFilterableTasks, deferredBoardSearch, taskAdvancedFilters]
  );

  const filteredTasks = useMemo(() => filteredBoardTasks.map((item) => item.task), [filteredBoardTasks]);
  const taskFilterCategories = useMemo(
    () =>
      Array.from(new Set(boardFilterableTasks.map((task) => normalizeProjectCategory(task.projectCategory)))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [boardFilterableTasks]
  );
  const taskFilterStatuses = useMemo(
    () =>
      Array.from(new Set(boardFilterableTasks.map((task) => task.taskStatus))).sort((left, right) => {
        const weight = (value: string) => {
          if (value === "TODO") return 0;
          if (value === "IN_PROGRESS") return 1;
          if (value === "DONE") return 2;
          return 3;
        };

        return weight(left) - weight(right) || left.localeCompare(right);
      }),
    [boardFilterableTasks]
  );
  const taskFilterPriorities = useMemo(
    () =>
      Array.from(new Set(boardFilterableTasks.map((task) => task.priorityLevel))).sort((left, right) => right - left),
    [boardFilterableTasks]
  );
  const taskFilterAssignees = useMemo(
    () =>
      Array.from(new Set(boardFilterableTasks.map((task) => task.assigneeName.trim() || "Unassigned"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [boardFilterableTasks]
  );
  const taskFilterStages = useMemo(
    () =>
      Array.from(new Set(boardFilterableTasks.map((task) => task.stageName.trim() || "To Do"))).sort((left, right) =>
        left.localeCompare(right)
      ),
    [boardFilterableTasks]
  );
  const boardTaskFilterConfig = useMemo(
    () => ({
      filters: taskAdvancedFilters,
      onChange: setTaskAdvancedFilters,
      options: {
        projectCategories: taskFilterCategories,
        statuses: taskFilterStatuses,
        priorities: taskFilterPriorities,
        assignees: taskFilterAssignees,
        stages: taskFilterStages,
      },
    }),
    [
      taskAdvancedFilters,
      taskFilterAssignees,
      taskFilterCategories,
      taskFilterPriorities,
      taskFilterStages,
      taskFilterStatuses,
    ]
  );

  const hasAdvancedTaskFilters =
    taskAdvancedFilters.projectCategories.length > 0 ||
    taskAdvancedFilters.statuses.length > 0 ||
    taskAdvancedFilters.priorities.length > 0 ||
    taskAdvancedFilters.assignees.length > 0 ||
    taskAdvancedFilters.stages.length > 0 ||
    taskAdvancedFilters.dueState !== "all";
  const hasTaskFilteringCriteria =
    deferredBoardSearch.trim().length > 0 || activeFilter !== "all" || hasAdvancedTaskFilters;
  const hasActiveToolbarFilters = hasTaskFilteringCriteria || activeGroupBy !== "none";

  const filteredGroupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};

    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of filteredTasks) {
      const assignedStageId = task.stageId && initial[task.stageId] ? task.stageId : stages[0]?.id;
      if (!assignedStageId) continue;
      initial[assignedStageId].push(task);
    }

    return initial;
  }, [filteredTasks, stages]);

  const filteredStageSummaries = useMemo(
    () =>
      new Map(
        stages.map((stage) => {
          const items = filteredGroupedTasks[stage.id] ?? [];
          const averageProgress =
            items.length > 0
              ? Math.round(items.reduce((total, task) => total + getTaskCompletionPercent(task), 0) / items.length)
              : 0;
          return [stage.id, { count: items.length, averageProgress }] as const;
        })
      ),
    [filteredGroupedTasks, stages]
  );

  const effectiveFoldedStages = useMemo(() => {
    const validStageIds = new Set(stages.map((stage) => stage.id));
    return Object.fromEntries(
      Object.entries(foldedStages).filter(([stageId, isFolded]) => validStageIds.has(stageId) && isFolded)
    );
  }, [foldedStages, stages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (Object.keys(effectiveFoldedStages).length === 0) {
      window.localStorage.removeItem(ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(ADMIN_PROJECT_TASK_FOLDED_STAGES_STORAGE_KEY, JSON.stringify(effectiveFoldedStages));
  }, [effectiveFoldedStages]);

  const clearBoardFilters = () => {
    setBoardSearch("");
    setActiveFilter("all");
    setActiveGroupBy("none");
    setTaskAdvancedFilters(createDefaultTaskAdvancedFilters());
  };

  const toggleStageFold = (stageId: string) => {
    setFoldedStages((current) => ({
      ...current,
      [stageId]: !current[stageId],
    }));
  };

  return {
    activeFilter,
    activeGroupBy,
    boardSearch,
    boardTaskFilterConfig,
    clearBoardFilters,
    filteredGroupedTasks,
    filteredStageSummaries,
    filteredTasks,
    getResponsibleName,
    getStageName,
    getTaskAssigneePerson,
    groupedTasks,
    hasActiveToolbarFilters,
    hasTaskFilteringCriteria,
    isSearchMenuOpen,
    setActiveFilter,
    setActiveGroupBy,
    setBoardSearch,
    setIsSearchMenuOpen,
    setViewMode,
    toggleStageFold,
    viewMode,
    foldedStages: effectiveFoldedStages,
  };
}
