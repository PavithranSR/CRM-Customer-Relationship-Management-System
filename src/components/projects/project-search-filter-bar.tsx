"use client";

import type { Priority, ProjectStatus } from "@prisma/client";
import { useMemo, useState } from "react";
import { SearchFilterToolbar } from "@/components/shared/search-filter-toolbar";
import {
  createDefaultProjectAdvancedFilters,
  createDefaultTaskAdvancedFilters,
  ProjectAdvancedFilters,
  ProjectFilterKey,
  ProjectGroupByKey,
  TaskAdvancedFilters,
  TaskBoardPriorityLevel,
  TaskBoardStatus,
  TaskDueStateKey,
} from "@/lib/project-board-filters";
import { cn } from "@/lib/utils";

interface TaskFilterConfig {
  filters: TaskAdvancedFilters;
  onChange: (value: TaskAdvancedFilters) => void;
  options: {
    projectCategories: string[];
    statuses: string[];
    priorities: TaskBoardPriorityLevel[];
    assignees: string[];
    stages: string[];
  };
}

interface ProjectFilterConfig {
  filters: ProjectAdvancedFilters;
  onChange: (value: ProjectAdvancedFilters) => void;
  options: {
    projectCategories: string[];
    statuses: ProjectStatus[];
    priorities: Priority[];
    managers: string[];
    stages: string[];
  };
}

interface ProjectSearchFilterBarProps {
  mode?: "projects" | "allTasks";
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  isSearchMenuOpen: boolean;
  onSearchMenuOpenChange: (open: boolean) => void;
  activeFilter: ProjectFilterKey;
  onActiveFilterChange: (value: ProjectFilterKey) => void;
  activeGroupBy: ProjectGroupByKey;
  onActiveGroupByChange: (value: ProjectGroupByKey) => void;
  onReset: () => void;
  projectFilterConfig?: ProjectFilterConfig;
  taskFilterConfig?: TaskFilterConfig;
}

const FILTER_OPTIONS: Array<{ value: ProjectFilterKey; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "team", label: "Team Projects" },
  { value: "individual", label: "Individual Projects" },
  { value: "high_priority", label: "High Priority" },
];

const PROJECT_GROUP_BY_OPTIONS: Array<{ value: ProjectGroupByKey; label: string }> = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "manager", label: "Manager" },
  { value: "stage", label: "Stage" },
  { value: "deadline", label: "Deadline" },
  { value: "category", label: "Category" },
];

const TASK_GROUP_BY_OPTIONS: Array<{ value: ProjectGroupByKey; label: string }> = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "priority", label: "Priority" },
  { value: "assignee", label: "Assignee" },
  { value: "stage", label: "Stage" },
  { value: "category", label: "Category" },
  { value: "deadline", label: "Deadline" },
];

const TASK_DUE_STATE_OPTIONS: Array<{ value: TaskDueStateKey; label: string }> = [
  { value: "all", label: "All Due Dates" },
  { value: "overdue", label: "Overdue" },
  { value: "due_this_week", label: "Next 7 Days" },
  { value: "no_due_date", label: "No Due Date" },
];

function toggleArrayValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function cloneTaskAdvancedFilters(filters: TaskAdvancedFilters): TaskAdvancedFilters {
  return {
    projectCategories: [...filters.projectCategories],
    statuses: [...filters.statuses],
    priorities: [...filters.priorities],
    assignees: [...filters.assignees],
    stages: [...filters.stages],
    dueState: filters.dueState,
  };
}

function cloneProjectAdvancedFilters(filters: ProjectAdvancedFilters): ProjectAdvancedFilters {
  return {
    projectCategories: [...filters.projectCategories],
    statuses: [...filters.statuses],
    priorities: [...filters.priorities],
    managers: [...filters.managers],
    stages: [...filters.stages],
    dueState: filters.dueState,
  };
}

function formatProjectStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatProjectPriorityLabel(priority: string) {
  return priority
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTaskStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTaskPriorityLabel(priority: number) {
  if (priority === 3) return "Urgent";
  if (priority === 2) return "High";
  if (priority === 1) return "Medium";
  return `Priority ${priority}`;
}

function formatDueStateLabel(value: TaskDueStateKey) {
  return TASK_DUE_STATE_OPTIONS.find((item) => item.value === value)?.label || value;
}

function FilterChoiceRow({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "block w-full rounded-lg px-3 py-2 text-left text-sm transition",
        isActive
          ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200"
          : "text-slate-700 hover:bg-white/80"
      )}
    >
      {label}
    </button>
  );
}

export function ProjectSearchFilterBar({
  mode = "projects",
  searchQuery,
  onSearchQueryChange,
  isSearchMenuOpen,
  onSearchMenuOpenChange,
  activeFilter,
  onActiveFilterChange,
  activeGroupBy,
  onActiveGroupByChange,
  onReset,
  projectFilterConfig,
  taskFilterConfig,
}: ProjectSearchFilterBarProps) {
  const [savedSearches, setSavedSearches] = useState<
    Array<{
      id: string;
      label: string;
      query: string;
      filter: ProjectFilterKey;
      groupBy: ProjectGroupByKey;
      scope: "projects" | "allTasks";
      projectFilters: ProjectAdvancedFilters | null;
      taskFilters: TaskAdvancedFilters | null;
    }>
  >([]);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);

  const projectFilters = projectFilterConfig?.filters;
  const taskFilters = taskFilterConfig?.filters;
  const groupByOptions = mode === "allTasks" ? TASK_GROUP_BY_OPTIONS : PROJECT_GROUP_BY_OPTIONS;
  const effectiveExpandedGroupKey =
    (mode === "allTasks" && taskFilterConfig) || (mode === "projects" && projectFilterConfig)
      ? expandedGroupKey
      : null;

  const updateProjectFilters = (updater: (current: ProjectAdvancedFilters) => ProjectAdvancedFilters) => {
    if (!projectFilterConfig) return;
    projectFilterConfig.onChange(updater(projectFilterConfig.filters));
  };

  const updateTaskFilters = (updater: (current: TaskAdvancedFilters) => TaskAdvancedFilters) => {
    if (!taskFilterConfig) return;
    taskFilterConfig.onChange(updater(taskFilterConfig.filters));
  };

  const activeChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; kind: "filter" | "group" }> = [
      ...(activeFilter !== "all"
        ? [
            {
              id: `preset:${activeFilter}`,
              label: FILTER_OPTIONS.find((item) => item.value === activeFilter)?.label || activeFilter,
              kind: "filter" as const,
            },
          ]
        : []),
      ...(activeGroupBy !== "none"
        ? [
            {
              id: `group:${activeGroupBy}`,
              label: groupByOptions.find((item) => item.value === activeGroupBy)?.label || activeGroupBy,
              kind: "group" as const,
            },
          ]
        : []),
    ];

    if (projectFilters) {
      projectFilters.projectCategories.forEach((category) => {
        chips.push({
          id: `project-category:${encodeURIComponent(category)}`,
          label: `Category: ${category}`,
          kind: "filter",
        });
      });

      projectFilters.statuses.forEach((status) => {
        chips.push({
          id: `project-status:${encodeURIComponent(status)}`,
          label: `Status: ${formatProjectStatusLabel(status)}`,
          kind: "filter",
        });
      });

      projectFilters.priorities.forEach((priority) => {
        chips.push({
          id: `project-priority:${encodeURIComponent(priority)}`,
          label: `Priority: ${formatProjectPriorityLabel(priority)}`,
          kind: "filter",
        });
      });

      projectFilters.managers.forEach((manager) => {
        chips.push({
          id: `project-manager:${encodeURIComponent(manager)}`,
          label: `Manager: ${manager}`,
          kind: "filter",
        });
      });

      projectFilters.stages.forEach((stage) => {
        chips.push({
          id: `project-stage:${encodeURIComponent(stage)}`,
          label: `Stage: ${stage}`,
          kind: "filter",
        });
      });

      if (projectFilters.dueState !== "all") {
        chips.push({
          id: `project-due:${projectFilters.dueState}`,
          label: `Due: ${formatDueStateLabel(projectFilters.dueState)}`,
          kind: "filter",
        });
      }
    }

    if (!taskFilters) {
      return chips;
    }

    taskFilters.projectCategories.forEach((category) => {
      chips.push({
        id: `task-category:${encodeURIComponent(category)}`,
        label: `Category: ${category}`,
        kind: "filter",
      });
    });

    taskFilters.statuses.forEach((status) => {
      chips.push({
        id: `task-status:${encodeURIComponent(status)}`,
        label: `Status: ${formatTaskStatusLabel(status)}`,
        kind: "filter",
      });
    });

    taskFilters.priorities.forEach((priority) => {
      chips.push({
        id: `task-priority:${priority}`,
        label: `Priority: ${formatTaskPriorityLabel(priority)}`,
        kind: "filter",
      });
    });

    taskFilters.assignees.forEach((assignee) => {
      chips.push({
        id: `task-assignee:${encodeURIComponent(assignee)}`,
        label: `Assignee: ${assignee}`,
        kind: "filter",
      });
    });

    taskFilters.stages.forEach((stage) => {
      chips.push({
        id: `task-stage:${encodeURIComponent(stage)}`,
        label: `Stage: ${stage}`,
        kind: "filter",
      });
    });

    if (taskFilters.dueState !== "all") {
      chips.push({
        id: `task-due:${taskFilters.dueState}`,
        label: `Due: ${formatDueStateLabel(taskFilters.dueState)}`,
        kind: "filter",
      });
    }

    return chips;
  }, [activeFilter, activeGroupBy, groupByOptions, projectFilters, taskFilters]);

  const visibleSavedSearches = useMemo(
    () => savedSearches.filter((item) => item.scope === mode),
    [mode, savedSearches]
  );

  const renderExpandedProjectGroupContent = (groupKey: string) => {
    if (!projectFilterConfig || !projectFilters || mode !== "projects") {
      return null;
    }

    if (groupKey === "category") {
      return projectFilterConfig.options.projectCategories.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {projectFilterConfig.options.projectCategories.map((category) => (
            <FilterChoiceRow
              key={category}
              label={category}
              isActive={projectFilters.projectCategories.includes(category)}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  projectCategories: toggleArrayValue(current.projectCategories, category),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No project categories found yet.</p>
      );
    }

    if (groupKey === "status") {
      return projectFilterConfig.options.statuses.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {projectFilterConfig.options.statuses.map((status) => (
            <FilterChoiceRow
              key={status}
              label={formatProjectStatusLabel(status)}
              isActive={projectFilters.statuses.includes(status)}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  statuses: toggleArrayValue(current.statuses, status),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No project statuses available.</p>
      );
    }

    if (groupKey === "priority") {
      return projectFilterConfig.options.priorities.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {projectFilterConfig.options.priorities.map((priority) => (
            <FilterChoiceRow
              key={priority}
              label={formatProjectPriorityLabel(priority)}
              isActive={projectFilters.priorities.includes(priority)}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  priorities: toggleArrayValue(current.priorities, priority),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No priorities available.</p>
      );
    }

    if (groupKey === "manager") {
      return projectFilterConfig.options.managers.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {projectFilterConfig.options.managers.map((manager) => (
            <FilterChoiceRow
              key={manager}
              label={manager}
              isActive={projectFilters.managers.includes(manager)}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  managers: toggleArrayValue(current.managers, manager),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No managers available.</p>
      );
    }

    if (groupKey === "stage") {
      return projectFilterConfig.options.stages.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {projectFilterConfig.options.stages.map((stage) => (
            <FilterChoiceRow
              key={stage}
              label={stage}
              isActive={projectFilters.stages.includes(stage)}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  stages: toggleArrayValue(current.stages, stage),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No stages available.</p>
      );
    }

    if (groupKey === "deadline") {
      return (
        <div className="space-y-1.5 py-1">
          {TASK_DUE_STATE_OPTIONS.map((option) => (
            <FilterChoiceRow
              key={option.value}
              label={option.label}
              isActive={projectFilters.dueState === option.value}
              onClick={() =>
                updateProjectFilters((current) => ({
                  ...current,
                  dueState: option.value,
                }))
              }
            />
          ))}
        </div>
      );
    }

    return null;
  };

  const renderExpandedTaskGroupContent = (groupKey: string) => {
    if (!taskFilterConfig || !taskFilters || mode !== "allTasks") {
      return null;
    }

    if (groupKey === "category") {
      return taskFilterConfig.options.projectCategories.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {taskFilterConfig.options.projectCategories.map((category) => (
            <FilterChoiceRow
              key={category}
              label={category}
              isActive={taskFilters.projectCategories.includes(category)}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  projectCategories: toggleArrayValue(current.projectCategories, category),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No project categories found yet.</p>
      );
    }

    if (groupKey === "status") {
      return taskFilterConfig.options.statuses.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {taskFilterConfig.options.statuses.map((status) => (
            <FilterChoiceRow
              key={status}
              label={formatTaskStatusLabel(status)}
              isActive={taskFilters.statuses.includes(status as TaskBoardStatus)}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  statuses: toggleArrayValue(current.statuses, status),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No task statuses available.</p>
      );
    }

    if (groupKey === "priority") {
      return taskFilterConfig.options.priorities.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {taskFilterConfig.options.priorities.map((priority) => (
            <FilterChoiceRow
              key={priority}
              label={formatTaskPriorityLabel(priority)}
              isActive={taskFilters.priorities.includes(priority)}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  priorities: toggleArrayValue(current.priorities, priority),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No priorities available.</p>
      );
    }

    if (groupKey === "assignee") {
      return taskFilterConfig.options.assignees.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {taskFilterConfig.options.assignees.map((assignee) => (
            <FilterChoiceRow
              key={assignee}
              label={assignee}
              isActive={taskFilters.assignees.includes(assignee)}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  assignees: toggleArrayValue(current.assignees, assignee),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No assignees available.</p>
      );
    }

    if (groupKey === "stage") {
      return taskFilterConfig.options.stages.length > 0 ? (
        <div className="space-y-1.5 py-1">
          {taskFilterConfig.options.stages.map((stage) => (
            <FilterChoiceRow
              key={stage}
              label={stage}
              isActive={taskFilters.stages.includes(stage)}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  stages: toggleArrayValue(current.stages, stage),
                }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">No stages available.</p>
      );
    }

    if (groupKey === "deadline") {
      return (
        <div className="space-y-1.5 py-1">
          {TASK_DUE_STATE_OPTIONS.map((option) => (
            <FilterChoiceRow
              key={option.value}
              label={option.label}
              isActive={taskFilters.dueState === option.value}
              onClick={() =>
                updateTaskFilters((current) => ({
                  ...current,
                  dueState: option.value,
                }))
              }
            />
          ))}
        </div>
      );
    }

    return null;
  };

  const renderExpandedGroupContent =
    mode === "allTasks" ? renderExpandedTaskGroupContent : renderExpandedProjectGroupContent;

  return (
    <SearchFilterToolbar
      query={searchQuery}
      onQueryChange={onSearchQueryChange}
      placeholder="Search..."
      isMenuOpen={isSearchMenuOpen}
      onMenuOpenChange={onSearchMenuOpenChange}
      selectedFilters={activeFilter === "all" ? [] : [activeFilter]}
      filterOptions={FILTER_OPTIONS}
      onToggleFilter={(value) =>
        onActiveFilterChange(value === activeFilter || value === "all" ? "all" : (value as ProjectFilterKey))
      }
      activeChips={activeChips}
      onRemoveChip={(id, kind) => {
        if (kind === "group") {
          onActiveGroupByChange("none");
          setExpandedGroupKey(null);
          return;
        }

        if (id.startsWith("preset:")) {
          onActiveFilterChange("all");
          return;
        }

        if (projectFilters) {
          if (id.startsWith("project-category:")) {
            const value = decodeURIComponent(id.replace("project-category:", ""));
            updateProjectFilters((current) => ({
              ...current,
              projectCategories: current.projectCategories.filter((item) => item !== value),
            }));
            return;
          }

          if (id.startsWith("project-status:")) {
            const value = decodeURIComponent(id.replace("project-status:", "")) as ProjectStatus;
            updateProjectFilters((current) => ({
              ...current,
              statuses: current.statuses.filter((item) => item !== value),
            }));
            return;
          }

          if (id.startsWith("project-priority:")) {
            const value = decodeURIComponent(id.replace("project-priority:", "")) as Priority;
            updateProjectFilters((current) => ({
              ...current,
              priorities: current.priorities.filter((item) => item !== value),
            }));
            return;
          }

          if (id.startsWith("project-manager:")) {
            const value = decodeURIComponent(id.replace("project-manager:", ""));
            updateProjectFilters((current) => ({
              ...current,
              managers: current.managers.filter((item) => item !== value),
            }));
            return;
          }

          if (id.startsWith("project-stage:")) {
            const value = decodeURIComponent(id.replace("project-stage:", ""));
            updateProjectFilters((current) => ({
              ...current,
              stages: current.stages.filter((item) => item !== value),
            }));
            return;
          }

          if (id.startsWith("project-due:")) {
            updateProjectFilters((current) => ({
              ...current,
              dueState: "all",
            }));
            return;
          }
        }

        if (!taskFilters) {
          onActiveFilterChange("all");
          return;
        }

        if (id.startsWith("task-category:")) {
          const value = decodeURIComponent(id.replace("task-category:", ""));
          updateTaskFilters((current) => ({
            ...current,
            projectCategories: current.projectCategories.filter((item) => item !== value),
          }));
          return;
        }

        if (id.startsWith("task-status:")) {
          const value = decodeURIComponent(id.replace("task-status:", ""));
          updateTaskFilters((current) => ({
            ...current,
            statuses: current.statuses.filter((item) => item !== value),
          }));
          return;
        }

        if (id.startsWith("task-priority:")) {
          const value = Number(id.replace("task-priority:", "")) as TaskBoardPriorityLevel;
          updateTaskFilters((current) => ({
            ...current,
            priorities: current.priorities.filter((item) => item !== value),
          }));
          return;
        }

        if (id.startsWith("task-assignee:")) {
          const value = decodeURIComponent(id.replace("task-assignee:", ""));
          updateTaskFilters((current) => ({
            ...current,
            assignees: current.assignees.filter((item) => item !== value),
          }));
          return;
        }

        if (id.startsWith("task-stage:")) {
          const value = decodeURIComponent(id.replace("task-stage:", ""));
          updateTaskFilters((current) => ({
            ...current,
            stages: current.stages.filter((item) => item !== value),
          }));
          return;
        }

        if (id.startsWith("task-due:")) {
          updateTaskFilters((current) => ({
            ...current,
            dueState: "all",
          }));
          return;
        }

        onActiveFilterChange("all");
      }}
      groupByValue={activeGroupBy}
      groupByOptions={groupByOptions}
      onGroupByChange={(value) => onActiveGroupByChange(value as ProjectGroupByKey)}
      onClearAll={() => {
        onReset();
        setExpandedGroupKey(null);
        onSearchMenuOpenChange(false);
      }}
      onSaveSearch={() => {
        const filterLabel = FILTER_OPTIONS.find((item) => item.value === activeFilter)?.label || "All";
        const groupLabel = groupByOptions.find((item) => item.value === activeGroupBy)?.label || "None";
        const advancedCount = projectFilters
          ? projectFilters.projectCategories.length
            + projectFilters.statuses.length
            + projectFilters.priorities.length
            + projectFilters.managers.length
            + projectFilters.stages.length
            + (projectFilters.dueState !== "all" ? 1 : 0)
          : taskFilters
            ? taskFilters.projectCategories.length
              + taskFilters.statuses.length
              + taskFilters.priorities.length
              + taskFilters.assignees.length
              + taskFilters.stages.length
              + (taskFilters.dueState !== "all" ? 1 : 0)
            : 0;
        const label =
          [
            searchQuery.trim(),
            activeFilter !== "all" ? filterLabel : "",
            activeGroupBy !== "none" ? groupLabel : "",
            advancedCount > 0 ? `${advancedCount} filters` : "",
          ]
            .filter(Boolean)
            .join(" / ") || "Saved search";

        setSavedSearches((current) => [
          {
            id: crypto.randomUUID(),
            label,
            query: searchQuery,
            filter: activeFilter,
            groupBy: activeGroupBy,
            scope: mode,
            projectFilters: projectFilters ? cloneProjectAdvancedFilters(projectFilters) : null,
            taskFilters: taskFilters ? cloneTaskAdvancedFilters(taskFilters) : null,
          },
          ...current,
        ]);
      }}
      savedSearches={visibleSavedSearches.map((item) => ({ id: item.id, label: item.label }))}
      onApplySavedSearch={(id) => {
        const selected = savedSearches.find((item) => item.id === id && item.scope === mode);
        if (!selected) return;
        onSearchQueryChange(selected.query);
        onActiveFilterChange(selected.filter);
        onActiveGroupByChange(selected.groupBy);
        if (projectFilterConfig) {
          projectFilterConfig.onChange(
            selected.projectFilters
              ? cloneProjectAdvancedFilters(selected.projectFilters)
              : createDefaultProjectAdvancedFilters()
          );
        }
        if (taskFilterConfig) {
          taskFilterConfig.onChange(
            selected.taskFilters ? cloneTaskAdvancedFilters(selected.taskFilters) : createDefaultTaskAdvancedFilters()
          );
        }
        setExpandedGroupKey(null);
        onSearchMenuOpenChange(false);
      }}
      expandedGroupKey={effectiveExpandedGroupKey}
      onExpandedGroupChange={setExpandedGroupKey}
      renderExpandedGroupContent={renderExpandedGroupContent}
      popoverContentClassName={
        taskFilterConfig || projectFilterConfig ? "w-[min(760px,calc(100vw-1rem))]" : undefined
      }
    />
  );
}
