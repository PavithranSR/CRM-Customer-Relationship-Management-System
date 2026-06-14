import {
  endOfDay,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
} from "date-fns";
import type { ProjectTask } from "@/lib/project-task-utils";
import { getTaskStatus } from "@/lib/project-task-utils";
import type {
  MilestoneStatus,
  ProjectMilestone,
  ProjectSprint,
  SprintStageKey,
  SprintStatus,
} from "@/lib/project-workflow-types";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function parseWorkflowDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueTaskIds(taskIds: string[]) {
  return Array.from(new Set(taskIds.filter(Boolean)));
}

export const MILESTONE_STATUS_OPTIONS: Array<{ value: MilestoneStatus; label: string }> = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REACHED", label: "Reached" },
  { value: "DELAYED", label: "Delayed" },
];

export const SPRINT_STATUS_OPTIONS: Array<{ value: SprintStatus; label: string }> = [
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const SPRINT_STAGE_OPTIONS: Array<{ value: SprintStageKey; label: string }> = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "TODO", label: "To Do" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "REVIEW", label: "Review" },
  { value: "DONE", label: "Done" },
];

export function getSprintStageLabel(stage: SprintStageKey) {
  return SPRINT_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? "Backlog";
}

export function getMilestoneStatusLabel(status: MilestoneStatus) {
  return MILESTONE_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? "Not Started";
}

export function getMilestoneSprints(milestone: ProjectMilestone, sprints: ProjectSprint[]) {
  return sprints.filter((sprint) => sprint.milestoneId === milestone.id);
}

export function getMilestoneDirectTaskIds(milestone: ProjectMilestone) {
  return uniqueTaskIds(milestone.taskLinks.map((link) => link.taskId));
}

export function getMilestoneTaskIds(milestone: ProjectMilestone, sprints: ProjectSprint[] = []) {
  const sprintTaskIds = getMilestoneSprints(milestone, sprints).flatMap((sprint) =>
    sprint.taskAssignments.map((assignment) => assignment.taskId)
  );
  return uniqueTaskIds([...getMilestoneDirectTaskIds(milestone), ...sprintTaskIds]);
}

function getSprintTaskStageLookup(sprints: ProjectSprint[]) {
  return new Map(
    sprints.flatMap((sprint) =>
      sprint.taskAssignments.map((assignment) => [assignment.taskId, assignment.stage] as const)
    )
  );
}

function isTaskDone(taskId: string, tasks: ProjectTask[], sprintStageLookup: Map<string, SprintStageKey>) {
  const task = tasks.find((item) => item.id === taskId);
  if (task) {
    return getTaskStatus(task) === "DONE";
  }

  return sprintStageLookup.get(taskId) === "DONE";
}

export function getMilestoneTaskCount(milestone: ProjectMilestone, sprints: ProjectSprint[] = []) {
  return getMilestoneTaskIds(milestone, sprints).length;
}

export function getMilestoneRequiredTaskCount(milestone: ProjectMilestone) {
  return milestone.taskLinks.filter((link) => link.required).length;
}

export function getMilestoneCompletedTaskCount(
  milestone: ProjectMilestone,
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = []
) {
  const relatedSprints = getMilestoneSprints(milestone, sprints);
  const sprintStageLookup = getSprintTaskStageLookup(relatedSprints);
  return getMilestoneTaskIds(milestone, sprints).filter((taskId) =>
    isTaskDone(taskId, tasks, sprintStageLookup)
  ).length;
}

export function getMilestoneSprintCount(milestone: ProjectMilestone, sprints: ProjectSprint[] = []) {
  return getMilestoneSprints(milestone, sprints).length;
}

export function getMilestoneCompletedSprintCount(
  milestone: ProjectMilestone,
  sprints: ProjectSprint[] = [],
  tasks: ProjectTask[] = []
) {
  return getMilestoneSprints(milestone, sprints).filter(
    (sprint) => sprint.status === "COMPLETED" || getSprintProgressPercent(sprint, tasks) >= 100
  ).length;
}

export function getMilestonePendingSprintCount(
  milestone: ProjectMilestone,
  sprints: ProjectSprint[] = [],
  tasks: ProjectTask[] = []
) {
  return Math.max(
    0,
    getMilestoneSprintCount(milestone, sprints) - getMilestoneCompletedSprintCount(milestone, sprints, tasks)
  );
}

export function getMilestoneCompletionPercent(
  milestone: ProjectMilestone,
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = []
) {
  const relatedSprints = getMilestoneSprints(milestone, sprints);
  const directTaskIds = getMilestoneDirectTaskIds(milestone).filter(
    (taskId) => !relatedSprints.some((sprint) => sprint.taskAssignments.some((assignment) => assignment.taskId === taskId))
  );
  const sprintProgressTotal = relatedSprints.reduce(
    (total, sprint) => total + getSprintProgressPercent(sprint, tasks),
    0
  );
  const directCompletedCount = directTaskIds.filter((taskId) =>
    isTaskDone(taskId, tasks, new Map())
  ).length;
  const totalUnits = relatedSprints.length + directTaskIds.length;

  if (totalUnits === 0) {
    return milestone.status === "REACHED" ? 100 : 0;
  }

  return clampPercent(
    Math.round((sprintProgressTotal + directCompletedCount * 100) / totalUnits)
  );
}

export function isMilestoneComplete(
  milestone: ProjectMilestone,
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = []
) {
  const relatedSprints = getMilestoneSprints(milestone, sprints);
  const taskCount = getMilestoneTaskCount(milestone, sprints);
  const completedTaskCount = getMilestoneCompletedTaskCount(milestone, tasks, sprints);

  if (relatedSprints.length === 0 && taskCount === 0) {
    return milestone.status === "REACHED";
  }

  const sprintsComplete =
    relatedSprints.length === 0 ||
    relatedSprints.every((sprint) => sprint.status === "COMPLETED" || getSprintProgressPercent(sprint, tasks) >= 100);
  const tasksComplete = taskCount === 0 || completedTaskCount >= taskCount;

  return sprintsComplete && tasksComplete;
}

export function getDerivedMilestoneStatus(
  milestone: ProjectMilestone,
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = [],
  now = new Date()
): MilestoneStatus {
  if (isMilestoneComplete(milestone, tasks, sprints)) {
    return "REACHED";
  }

  const completionPercent = getMilestoneCompletionPercent(milestone, tasks, sprints);
  const targetDate = parseWorkflowDate(milestone.targetDate);

  if (targetDate && isBefore(startOfDay(targetDate), startOfDay(now))) {
    return "DELAYED";
  }

  if (completionPercent > 0) {
    return "IN_PROGRESS";
  }

  return milestone.status === "DELAYED" ? "DELAYED" : "NOT_STARTED";
}

export function isMilestoneUpcoming(milestone: ProjectMilestone, now = new Date()) {
  const targetDate = parseWorkflowDate(milestone.targetDate);
  return Boolean(targetDate && !isBefore(targetDate, startOfDay(now)));
}

export function isMilestoneDelayed(
  milestone: ProjectMilestone,
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = [],
  now = new Date()
) {
  return getDerivedMilestoneStatus(milestone, tasks, sprints, now) === "DELAYED";
}

export function getSprintTaskAssignments(sprint: ProjectSprint) {
  return sprint.taskAssignments;
}

export function getSprintTaskCount(sprint: ProjectSprint) {
  return sprint.taskAssignments.length;
}

export function getSprintCompletedTaskCount(sprint: ProjectSprint, tasks: ProjectTask[]) {
  return sprint.taskAssignments.filter((assignment) => {
    const task = tasks.find((item) => item.id === assignment.taskId);
    return task ? getTaskStatus(task) === "DONE" : assignment.stage === "DONE";
  }).length;
}

export function getSprintPendingTaskCount(sprint: ProjectSprint, tasks: ProjectTask[]) {
  return Math.max(0, getSprintTaskCount(sprint) - getSprintCompletedTaskCount(sprint, tasks));
}

export function getSprintProgressPercent(sprint: ProjectSprint, tasks: ProjectTask[]) {
  const total = getSprintTaskCount(sprint);
  if (total === 0) {
    return sprint.status === "COMPLETED" ? 100 : 0;
  }

  return clampPercent(Math.round((getSprintCompletedTaskCount(sprint, tasks) / total) * 100));
}

export function isSprintOverdue(sprint: ProjectSprint, tasks: ProjectTask[], now = new Date()) {
  if (sprint.status === "COMPLETED" || sprint.status === "CANCELLED") {
    return false;
  }

  const endDate = parseWorkflowDate(sprint.endDate);
  if (!endDate) {
    return false;
  }

  const pendingTasks = getSprintPendingTaskCount(sprint, tasks);
  return isBefore(endOfDay(endDate), startOfDay(now)) && pendingTasks > 0;
}

export function getSprintDeadlineLabel(sprint: ProjectSprint) {
  const endDate = parseWorkflowDate(sprint.endDate);
  return endDate ? format(endDate, "MMM d, yyyy") : "No end date";
}

export function getTaskSprintStage(taskId: string, sprint: ProjectSprint) {
  return sprint.taskAssignments.find((assignment) => assignment.taskId === taskId)?.stage ?? "BACKLOG";
}

export function findSprintForTask(taskId: string, sprints: ProjectSprint[]) {
  return sprints.find((sprint) => sprint.taskAssignments.some((assignment) => assignment.taskId === taskId));
}

export function getTaskMilestoneId(taskId: string, milestones: ProjectMilestone[], sprints: ProjectSprint[] = []) {
  const milestoneByTaskLink = milestones.find((milestone) =>
    milestone.taskLinks.some((link) => link.taskId === taskId)
  );
  if (milestoneByTaskLink) {
    return milestoneByTaskLink.id;
  }

  return sprints.find((sprint) => sprint.taskAssignments.some((assignment) => assignment.taskId === taskId))
    ?.milestoneId;
}

export function groupSprintTasksByStage() {
  return SPRINT_STAGE_OPTIONS.reduce<Record<SprintStageKey, ProjectTask[]>>((acc, option) => {
    acc[option.value] = [];
    return acc;
  }, {} as Record<SprintStageKey, ProjectTask[]>);
}

export function getSprintTaskBuckets(sprint: ProjectSprint, tasks: ProjectTask[]) {
  const buckets = SPRINT_STAGE_OPTIONS.reduce<Record<SprintStageKey, ProjectTask[]>>(
    (acc, option) => {
      acc[option.value] = [];
      return acc;
    },
    {} as Record<SprintStageKey, ProjectTask[]>
  );

  for (const assignment of sprint.taskAssignments) {
    const task = tasks.find((item) => item.id === assignment.taskId);
    if (!task) {
      continue;
    }
    buckets[assignment.stage].push(task);
  }

  return buckets;
}

export function getMilestoneTaskBuckets(
  milestones: ProjectMilestone[],
  tasks: ProjectTask[],
  sprints: ProjectSprint[] = []
) {
  const buckets = {
    NOT_STARTED: [] as ProjectMilestone[],
    IN_PROGRESS: [] as ProjectMilestone[],
    REACHED: [] as ProjectMilestone[],
    DELAYED: [] as ProjectMilestone[],
  };

  for (const milestone of milestones) {
    const status = getDerivedMilestoneStatus(milestone, tasks, sprints);
    buckets[status].push(milestone);
  }

  return buckets;
}

export function getProjectWorkflowCompletionPercent(
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[],
  tasks: ProjectTask[]
) {
  if (milestones.length === 0) {
    return 0;
  }

  const total = milestones.reduce(
    (sum, milestone) => sum + getMilestoneCompletionPercent(milestone, tasks, sprints),
    0
  );
  return clampPercent(Math.round(total / milestones.length));
}

export function isProjectWorkflowComplete(
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[],
  tasks: ProjectTask[]
) {
  return milestones.length > 0 && milestones.every((milestone) => isMilestoneComplete(milestone, tasks, sprints));
}

export function isSprintWithinMilestoneWindow(sprint: Pick<ProjectSprint, "startDate" | "endDate">, milestone: Pick<ProjectMilestone, "startDate" | "targetDate">) {
  const sprintStart = parseWorkflowDate(sprint.startDate);
  const sprintEnd = parseWorkflowDate(sprint.endDate);
  const milestoneStart = parseWorkflowDate(milestone.startDate);
  const milestoneEnd = parseWorkflowDate(milestone.targetDate);

  if (!sprintStart || !sprintEnd || !milestoneStart || !milestoneEnd) {
    return false;
  }

  return !isBefore(startOfDay(sprintStart), startOfDay(milestoneStart)) &&
    !isAfter(endOfDay(sprintEnd), endOfDay(milestoneEnd));
}

export function isTaskWithinSprintWindow(task: Pick<ProjectTask, "dueDate">, sprint: Pick<ProjectSprint, "startDate" | "endDate">) {
  const dueDate = parseWorkflowDate(task.dueDate);
  const sprintStart = parseWorkflowDate(sprint.startDate);
  const sprintEnd = parseWorkflowDate(sprint.endDate);

  if (!dueDate || !sprintStart || !sprintEnd) {
    return false;
  }

  return !isBefore(startOfDay(dueDate), startOfDay(sprintStart)) &&
    !isAfter(endOfDay(dueDate), endOfDay(sprintEnd));
}

export function sortMilestonesByDate(milestones: ProjectMilestone[]) {
  return [...milestones].sort((left, right) => {
    const leftDate = parseWorkflowDate(left.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate = parseWorkflowDate(right.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || left.createdAt.localeCompare(right.createdAt);
  });
}

export function sortSprintsByDate(sprints: ProjectSprint[]) {
  return [...sprints].sort((left, right) => {
    const leftDate = parseWorkflowDate(left.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate = parseWorkflowDate(right.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || left.createdAt.localeCompare(right.createdAt);
  });
}

export function sortMilestonesForTimeline(milestones: ProjectMilestone[]) {
  return [...milestones].sort((left, right) => {
    const leftStart = parseWorkflowDate(left.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightStart = parseWorkflowDate(right.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const startCompare = leftStart - rightStart;
    if (startCompare !== 0) {
      return startCompare;
    }

    const leftTarget = parseWorkflowDate(left.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTarget = parseWorkflowDate(right.targetDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTarget - rightTarget;
  });
}

export function isSameWorkflowDay(left: string, right: Date) {
  const parsed = parseWorkflowDate(left);
  return Boolean(parsed && isSameDay(parsed, right));
}
