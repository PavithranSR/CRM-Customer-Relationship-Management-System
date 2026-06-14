import { ProjectStatus } from "@prisma/client";
import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { db } from "@/lib/db";
import {
  getTaskCompletionPercent,
  normalizeTask,
  type ProjectTask,
} from "@/lib/project-task-utils";
import type {
  EmployeePerformanceChangeItem,
  EmployeePerformanceChartDatum,
  EmployeePerformanceDetailResponse,
  EmployeePerformanceListItem,
  EmployeePerformanceListResponse,
  EmployeePerformanceProjectRow,
  EmployeePerformanceRange,
  EmployeePerformanceRevenueTrendDatum,
  EmployeePerformanceTaskBarDatum,
  EmployeePerformanceTaskRow,
  EmployeePerformanceTrendDatum,
} from "@/lib/employee-performance-types";

const EMPLOYEE_PERFORMANCE_ROLES = ["BA", "TEAMLEADER", "EMPLOYEE"] as const;
const DEFAULT_FINAL_STAGE_ID = "done";

type RangeWindow = {
  range: EmployeePerformanceRange;
  start: Date;
  end: Date;
  label: string;
  buckets: Array<{
    key: string;
    label: string;
    start: Date;
    end: Date;
  }>;
};

type LatestTaskState = {
  tasks: ProjectTask[];
  finalStageId: string;
  stages: Array<{
    id: string;
    name: string;
    sortOrder?: number;
  }>;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toTitleCase(value: string) {
  return value
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDateInRange(value: Date | string | null | undefined, range: RangeWindow) {
  const parsed = toDate(value);
  if (!parsed) return false;
  return isWithinInterval(parsed, { start: range.start, end: range.end });
}

function getRangeWindow(range: EmployeePerformanceRange, now = new Date()): RangeWindow {
  if (range === "daily") {
    const start = startOfDay(now);
    const end = endOfDay(now);

    return {
      range,
      start,
      end,
      label: format(start, "MMM d, yyyy"),
      buckets: [
        {
          key: format(start, "yyyy-MM-dd"),
          label: format(start, "MMM d"),
          start,
          end,
        },
      ],
    };
  }

  if (range === "weekly") {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });

    return {
      range,
      start,
      end,
      label: `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`,
      buckets: eachDayOfInterval({ start, end }).map((day) => ({
        key: format(day, "yyyy-MM-dd"),
        label: format(day, "EEE"),
        start: startOfDay(day),
        end: endOfDay(day),
      })),
    };
  }

  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return {
    range,
    start,
    end,
    label: format(start, "MMMM yyyy"),
    buckets: eachDayOfInterval({ start, end }).map((day) => ({
      key: format(day, "yyyy-MM-dd"),
      label: format(day, "MMM d"),
      start: startOfDay(day),
      end: endOfDay(day),
    })),
  };
}

function getBucketKey(value: Date | string | null | undefined) {
  const parsed = toDate(value);
  if (!parsed) return null;
  return format(parsed, "yyyy-MM-dd");
}

function formatActivityDateValue(value: unknown) {
  const parsed = toDate(typeof value === "string" || value instanceof Date ? value : null);
  if (!parsed) return "-";
  return format(parsed, "MMM d, yyyy");
}

function truncateText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function getStageLabel(stageId: string | null | undefined, stageLabels: Map<string, string>) {
  if (!stageId) return "Unknown";
  return stageLabels.get(stageId) ?? toTitleCase(stageId);
}

function getCommercialProjectValue(project: {
  finalAmount: number | null;
  subtotalAmount: number | null;
  profitAmount: number | null;
  unitCount: number | null;
  unitPrice: number | null;
}) {
  return (
    project.finalAmount ??
    project.subtotalAmount ??
    project.profitAmount ??
    (project.unitCount ?? 0) * (project.unitPrice ?? 0)
  );
}

function getDisplayProjectStatus(status: ProjectStatus) {
  return status === "COMPLETED" || status === "CANCELLED" ? "Completed" : "Ongoing";
}

function getTaskOwnerId(task: Pick<ProjectTask, "employeeAssigneeId" | "assigneeId">) {
  if (task.employeeAssigneeId && task.employeeAssigneeId.length > 0) {
    return task.employeeAssigneeId;
  }

  const fallback = task.assigneeId.trim();
  return fallback.length > 0 ? fallback : null;
}

function isTaskRelevantToEmployee(task: ProjectTask, employeeId: string) {
  return (
    getTaskOwnerId(task) === employeeId ||
    task.updates.some((update) => update.byUserId === employeeId) ||
    (task.subtasks ?? []).some((subtask) => subtask.assigneeId === employeeId)
  );
}

function getTaskCompletionTimestamp(input: {
  task: ProjectTask;
  logs: Array<{ createdAt: Date; metadata: unknown }>;
  finalStageId: string;
}) {
  let completedAt: string | null = null;

  for (const log of input.logs) {
    const metadata =
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : null;

    if (!metadata || metadata.actionType !== "MOVE_STAGE") {
      continue;
    }

    const targetStageId =
      typeof metadata.targetStageId === "string" ? metadata.targetStageId : null;
    const progress =
      typeof metadata.progress === "number"
        ? metadata.progress
        : typeof metadata.progress === "string"
          ? Number(metadata.progress)
          : null;

    if (
      targetStageId === input.finalStageId ||
      (typeof progress === "number" && !Number.isNaN(progress) && progress >= 100)
    ) {
      completedAt = log.createdAt.toISOString();
      continue;
    }

    if (completedAt && targetStageId && targetStageId !== input.finalStageId) {
      completedAt = null;
    }
  }

  if (!completedAt && getTaskCompletionPercent(input.task) >= 100) {
    const latestEmployeeUpdate = [...input.task.updates]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
    completedAt = latestEmployeeUpdate?.createdAt ?? input.task.createdAt;
  }

  return completedAt;
}

function getTaskAllocationWeight(input: {
  task: ProjectTask;
  employeeId: string;
  range: RangeWindow;
  completionDate: string | null;
}) {
  const progressWeight = Math.max(0.4, getTaskCompletionPercent(input.task) / 100);
  const updateCount = input.task.updates.filter(
    (update) => update.byUserId === input.employeeId && isDateInRange(update.createdAt, input.range)
  ).length;
  const createdBonus = isDateInRange(input.task.createdAt, input.range) ? 0.3 : 0;
  const completionBonus = input.completionDate && isDateInRange(input.completionDate, input.range) ? 0.9 : 0;
  const activeBonus =
    getTaskOwnerId(input.task) === input.employeeId && getTaskCompletionPercent(input.task) < 100
      ? 0.5
      : 0.15;

  return 0.5 + progressWeight + updateCount * 0.85 + createdBonus + completionBonus + activeBonus;
}

function taskMatchesSelectedRange(input: {
  task: ProjectTask;
  employeeId: string;
  range: RangeWindow;
  completionDate: string | null;
}) {
  const hasEmployeeUpdateInRange = input.task.updates.some(
    (update) => update.byUserId === input.employeeId && isDateInRange(update.createdAt, input.range)
  );
  const isCreatedInRange = isDateInRange(input.task.createdAt, input.range);
  const isCompletedInRange = input.completionDate && isDateInRange(input.completionDate, input.range);
  const isStillAssignedAndOpen =
    getTaskOwnerId(input.task) === input.employeeId && getTaskCompletionPercent(input.task) < 100;

  return Boolean(hasEmployeeUpdateInRange || isCreatedInRange || isCompletedInRange || isStillAssignedAndOpen);
}

async function loadLatestTaskStates(projectIds: string[]) {
  if (projectIds.length === 0) {
    return new Map<string, LatestTaskState>();
  }

  const taskLogs = await db.activityLog.findMany({
    where: {
      entityType: "project_task_state",
      projectId: { in: projectIds },
    },
    orderBy: { createdAt: "desc" },
    select: {
      projectId: true,
      metadata: true,
    },
  });

  const states = new Map<string, LatestTaskState>();

  for (const log of taskLogs) {
    if (!log.projectId || states.has(log.projectId)) {
      continue;
    }

    const metadata =
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : null;
    const rawTasks = Array.isArray(metadata?.tasks) ? metadata.tasks : [];
    const rawStages = Array.isArray(metadata?.stages) ? metadata.stages : [];
    const stages = rawStages
      .filter((stage): stage is { id: string; name?: string; sortOrder?: number } =>
        Boolean(stage) && typeof stage === "object" && "id" in stage && typeof stage.id === "string"
      )
      .map((stage) => ({
        id: stage.id,
        name: typeof stage.name === "string" && stage.name.trim().length > 0 ? stage.name : toTitleCase(stage.id),
        sortOrder: stage.sortOrder,
      }))
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

    states.set(log.projectId, {
      tasks: rawTasks.map((task) => normalizeTask(task)).filter((task): task is ProjectTask => Boolean(task)),
      finalStageId: stages[stages.length - 1]?.id ?? DEFAULT_FINAL_STAGE_ID,
      stages,
    });
  }

  return states;
}

export function parseEmployeePerformanceRange(value: string | null | undefined): EmployeePerformanceRange {
  return value === "daily" || value === "weekly" || value === "monthly" ? value : "monthly";
}

export function parseEmployeePerformanceReferenceDate(
  value: string | null | undefined,
  fallback = new Date()
) {
  return toDate(value) ?? fallback;
}

export async function getEmployeePerformanceListData(): Promise<EmployeePerformanceListResponse> {
  const range = getRangeWindow("monthly");

  const employees = await db.user.findMany({
    where: {
      role: { in: [...EMPLOYEE_PERFORMANCE_ROLES] },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      hireDate: true,
      isActive: true,
      assignments: {
        where: { isActive: true },
        select: {
          projectId: true,
          project: {
            select: {
              status: true,
              finalAmount: true,
              subtotalAmount: true,
              profitAmount: true,
              unitCount: true,
              unitPrice: true,
            },
          },
        },
      },
      timeEntries: {
        where: {
          date: {
            gte: range.start,
            lte: range.end,
          },
        },
        select: {
          projectId: true,
          hours: true,
        },
      },
    },
  });

  const projectIds = Array.from(
    new Set(
      employees.flatMap((employee) => [
        ...employee.assignments.map((assignment) => assignment.projectId),
        ...employee.timeEntries.map((entry) => entry.projectId),
      ])
    )
  );

  const [projectHourRows, projectMetaRows] = await Promise.all([
    projectIds.length
      ? db.timeEntry.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            date: {
              gte: range.start,
              lte: range.end,
            },
          },
          _sum: { hours: true },
        })
      : Promise.resolve([]),
    projectIds.length
      ? db.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            finalAmount: true,
            subtotalAmount: true,
            profitAmount: true,
            unitCount: true,
            unitPrice: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const totalHoursByProject = new Map(
    projectHourRows.map((row) => [row.projectId, row._sum.hours ?? 0])
  );
  const projectValueById = new Map(
    projectMetaRows.map((project) => [project.id, getCommercialProjectValue(project)])
  );

  const employeeRows: EmployeePerformanceListItem[] = employees
    .map((employee) => {
      const hoursByProject = new Map<string, number>();
      let monthlyHours = 0;

      for (const entry of employee.timeEntries) {
        monthlyHours += entry.hours;
        hoursByProject.set(entry.projectId, (hoursByProject.get(entry.projectId) ?? 0) + entry.hours);
      }

      let monthlyRevenue = 0;
      for (const [projectId, projectHours] of hoursByProject.entries()) {
        const totalProjectHours = totalHoursByProject.get(projectId) ?? 0;
        if (projectHours <= 0 || totalProjectHours <= 0) {
          continue;
        }

        const projectValue = projectValueById.get(projectId) ?? 0;
        monthlyRevenue += projectValue * clamp(projectHours / totalProjectHours, 0, 1);
      }

      return {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        position: employee.position,
        joinDate: toIsoString(employee.hireDate),
        isActive: employee.isActive,
        totalProjects: employee.assignments.length,
        completedProjects: employee.assignments.filter(
          (assignment) => assignment.project.status === "COMPLETED" || assignment.project.status === "CANCELLED"
        ).length,
        monthlyHours: round2(monthlyHours),
        monthlyRevenue: round2(monthlyRevenue),
      };
    })
    .sort(
      (left, right) =>
        Number(right.isActive) - Number(left.isActive) ||
        right.monthlyRevenue - left.monthlyRevenue ||
        right.monthlyHours - left.monthlyHours ||
        right.totalProjects - left.totalProjects ||
        left.name.localeCompare(right.name)
    );

  const summary = employeeRows.reduce(
    (acc, employee) => {
      acc.employeeCount += 1;
      acc.activeEmployees += employee.isActive ? 1 : 0;
      acc.totalProjects += employee.totalProjects;
      acc.monthlyHours += employee.monthlyHours;
      acc.monthlyRevenue += employee.monthlyRevenue;
      return acc;
    },
    {
      employeeCount: 0,
      activeEmployees: 0,
      totalProjects: 0,
      monthlyHours: 0,
      monthlyRevenue: 0,
      averageProjectsPerEmployee: 0,
    }
  );

  summary.monthlyHours = round2(summary.monthlyHours);
  summary.monthlyRevenue = round2(summary.monthlyRevenue);
  summary.averageProjectsPerEmployee =
    summary.employeeCount > 0 ? round2(summary.totalProjects / summary.employeeCount) : 0;

  return {
    range: range.range,
    rangeLabel: range.label,
    summary,
    employees: employeeRows,
  };
}

export async function getEmployeePerformanceDetailData(
  employeeId: string,
  selectedRange: EmployeePerformanceRange,
  referenceDate = new Date()
): Promise<EmployeePerformanceDetailResponse | null> {
  const range = getRangeWindow(selectedRange, referenceDate);

  const employee = await db.user.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      position: true,
      phone: true,
      hireDate: true,
      isActive: true,
      assignments: {
        where: { isActive: true },
        select: {
          projectId: true,
          project: {
            select: {
              id: true,
            },
          },
        },
      },
      timeEntries: {
        where: {
          date: {
            gte: range.start,
            lte: range.end,
          },
        },
        select: {
          projectId: true,
          date: true,
          hours: true,
          isBillable: true,
        },
      },
    },
  });

  if (!employee || !EMPLOYEE_PERFORMANCE_ROLES.includes(employee.role as (typeof EMPLOYEE_PERFORMANCE_ROLES)[number])) {
    return null;
  }

  const projectIds = Array.from(
    new Set([
      ...employee.assignments.map((assignment) => assignment.projectId),
      ...employee.timeEntries.map((entry) => entry.projectId),
    ])
  );

  const projects = projectIds.length
    ? await db.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          deadline: true,
          estimatedHours: true,
          actualHours: true,
          finalAmount: true,
          subtotalAmount: true,
          profitAmount: true,
          unitCount: true,
          unitPrice: true,
          assignments: {
            where: { isActive: true },
            select: {
              userId: true,
            },
          },
          timeEntries: {
            where: {
              date: {
                gte: range.start,
                lte: range.end,
              },
            },
            select: {
              userId: true,
              date: true,
              hours: true,
              isBillable: true,
            },
          },
        },
      })
    : [];

  const latestTaskStates = await loadLatestTaskStates(projectIds);

  const relevantTasksByProject = new Map<
    string,
    Array<{
      task: ProjectTask;
      completionDate: string | null;
    }>
  >();

  const allRelevantTaskIds: string[] = [];
  for (const project of projects) {
    const taskState = latestTaskStates.get(project.id);
    if (!taskState) continue;

    const relevantTasks = taskState.tasks
      .filter((task) => isTaskRelevantToEmployee(task, employee.id))
      .map((task) => ({ task, completionDate: null as string | null }));

    if (relevantTasks.length > 0) {
      relevantTasksByProject.set(project.id, relevantTasks);
      allRelevantTaskIds.push(...relevantTasks.map((item) => item.task.id));
    }
  }

  const taskLogs = allRelevantTaskIds.length
    ? await db.activityLog.findMany({
        where: {
          entityType: "project_task",
          entityId: { in: allRelevantTaskIds },
        },
        orderBy: { createdAt: "asc" },
        select: {
          entityId: true,
          createdAt: true,
          metadata: true,
        },
      })
    : [];

  const taskLogsById = new Map<string, Array<{ createdAt: Date; metadata: unknown }>>();
  for (const log of taskLogs) {
    const next = taskLogsById.get(log.entityId) ?? [];
    next.push({
      createdAt: log.createdAt,
      metadata: log.metadata,
    });
    taskLogsById.set(log.entityId, next);
  }

  for (const project of projects) {
    const taskState = latestTaskStates.get(project.id);
    const relevant = relevantTasksByProject.get(project.id);

    if (!taskState || !relevant) {
      continue;
    }

    relevantTasksByProject.set(
      project.id,
      relevant.map((item) => ({
        ...item,
        completionDate: getTaskCompletionTimestamp({
          task: item.task,
          logs: taskLogsById.get(item.task.id) ?? [],
          finalStageId: taskState.finalStageId,
        }),
      }))
    );
  }

  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const taskContextById = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      taskName: string;
    }
  >();
  const stageLabelsByProjectId = new Map(
    projects.map((project) => [
      project.id,
      new Map((latestTaskStates.get(project.id)?.stages ?? []).map((stage) => [stage.id, stage.name])),
    ])
  );

  for (const project of projects) {
    const relevantTasks = relevantTasksByProject.get(project.id) ?? [];
    for (const item of relevantTasks) {
      taskContextById.set(item.task.id, {
        projectId: project.id,
        projectName: project.name,
        taskName: item.task.title,
      });
    }
  }

  const activityLogs = projectIds.length
    ? await db.activityLog.findMany({
        where: {
          projectId: { in: projectIds },
          createdAt: {
            gte: range.start,
            lte: range.end,
          },
          OR: [
            { entityType: "project_task", userId: employee.id },
            { entityType: "project_task", createdById: employee.id },
            { entityType: "task_comment", userId: employee.id },
            { entityType: "task_comment", createdById: employee.id },
            ...(allRelevantTaskIds.length > 0
              ? [
                  { entityType: "project_task", entityId: { in: allRelevantTaskIds } },
                  { entityType: "task_comment", entityId: { in: allRelevantTaskIds } },
                ]
              : []),
          ],
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      })
    : [];

  const completedTaskIds = new Set<string>();
  const changeItems: EmployeePerformanceChangeItem[] = activityLogs.map((log) => {
    const metadata =
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : {};
    const taskContext = taskContextById.get(log.entityId);
    const stageLabels = stageLabelsByProjectId.get(log.projectId ?? "") ?? new Map<string, string>();
    const actorName = log.createdBy.name || log.createdBy.email || "System";
    const taskName =
      taskContext?.taskName ??
      (typeof metadata.title === "string" && metadata.title.trim().length > 0 ? metadata.title : null);
    const projectName = taskContext?.projectName ?? projectNameById.get(log.projectId ?? "") ?? null;
    const actionType = typeof metadata.actionType === "string" ? metadata.actionType : "";
    let title = "Task activity";
    let detail = "Task action recorded in the selected period.";
    let field = typeof metadata.field === "string" ? metadata.field : "Task";

    if (log.entityType === "task_comment") {
      title = "Comment added";
      detail = truncateText(String(metadata.text ?? "No comment"));
      field = "Comment";
    } else if (log.action === "CREATE" && log.entityType === "project_task") {
      title = "Task created";
      detail = truncateText(String(metadata.title ?? taskContext?.taskName ?? "New task"));
      field = "Task";
    } else if (actionType === "MOVE_STAGE") {
      const previousStageId =
        typeof metadata.previousStageId === "string" ? metadata.previousStageId : undefined;
      const targetStageId = typeof metadata.targetStageId === "string" ? metadata.targetStageId : undefined;
      title = "Stage changed";
      detail = `${getStageLabel(previousStageId, stageLabels)} -> ${getStageLabel(targetStageId, stageLabels)}`;
      field = "Stage";

      const finalStageId = latestTaskStates.get(log.projectId ?? "")?.finalStageId;
      const progress = typeof metadata.progress === "number" ? metadata.progress : Number(metadata.progress ?? NaN);
      if ((targetStageId && finalStageId && targetStageId === finalStageId) || (!Number.isNaN(progress) && progress >= 100)) {
        completedTaskIds.add(log.entityId);
      }
    } else if (typeof metadata.comment === "string" && metadata.comment.trim().length > 0) {
      title = "Daily update";
      detail = truncateText(metadata.comment.trim());
      field = "Update";
    } else if (actionType === "CHANGE_DEADLINE") {
      title = "Deadline changed";
      detail = `${formatActivityDateValue(metadata.previousDueDate)} -> ${formatActivityDateValue(metadata.newDueDate)}`;
      field = "Deadline";
    } else if (actionType === "CHANGE_PRIORITY") {
      title = "Priority changed";
      detail = `${String(metadata.previousPriority ?? "-")} -> ${String(metadata.newPriority ?? "-")}`;
      field = "Priority";
    } else if (actionType === "CHANGE_TITLE") {
      title = "Title changed";
      detail = `${String(metadata.previousTitle ?? "Untitled")} -> ${String(metadata.newTitle ?? "Untitled")}`;
      field = "Title";
    } else if (actionType === "CHANGE_DESCRIPTION") {
      title = "Description updated";
      detail = "Task description was edited.";
      field = "Description";
    } else if (actionType === "ADD_SUBTASK") {
      title = "Sub-task added";
      detail = truncateText(String(metadata.subtaskTitle ?? "New sub-task"));
      field = "Sub-task";
    } else if (actionType === "EDIT") {
      title = "Task updated";
      detail = "Task details were edited.";
      field = "Task";
    } else if (log.action === "DELETE") {
      title = "Task deleted";
      detail = truncateText(String(metadata.title ?? taskContext?.taskName ?? "Task removed"));
      field = "Task";
    }

    return {
      id: log.id,
      title,
      detail,
      field,
      projectName,
      taskName,
      actorName,
      timestamp: log.createdAt.toISOString(),
    };
  });

  const changeSummary = changeItems.reduce(
    (acc, item) => {
      acc.totalChanges += 1;
      if (item.title === "Stage changed") acc.stageChanges += 1;
      if (item.title === "Daily update") acc.dailyUpdates += 1;
      if (item.title === "Comment added") acc.commentsAdded += 1;
      if (item.title === "Task created") acc.tasksCreated += 1;
      return acc;
    },
    {
      totalChanges: 0,
      stageChanges: 0,
      dailyUpdates: 0,
      commentsAdded: 0,
      tasksCreated: 0,
      tasksCompleted: 0,
    }
  );
  changeSummary.tasksCompleted = completedTaskIds.size;

  const projectRows: EmployeePerformanceProjectRow[] = [];
  const taskRows: EmployeePerformanceTaskRow[] = [];
  const taskCompletionChart: EmployeePerformanceTaskBarDatum[] = [];
  const projectContributionChart: EmployeePerformanceChartDatum[] = [];
  const performanceTrendMap = new Map<string, EmployeePerformanceTrendDatum>(
    range.buckets.map((bucket) => [
      bucket.key,
      {
        label: bucket.label,
        hours: 0,
        tasksCompleted: 0,
      },
    ])
  );
  const revenueTrendMap = new Map<string, EmployeePerformanceRevenueTrendDatum>(
    range.buckets.map((bucket) => [
      bucket.key,
      {
        label: bucket.label,
        revenue: 0,
      },
    ])
  );

  let totalHours = 0;
  let billableHours = 0;
  let totalRevenue = 0;
  let totalTasks = 0;
  let completedTasks = 0;

  for (const project of projects) {
    const taskState = latestTaskStates.get(project.id);
    const employeeTasks = relevantTasksByProject.get(project.id) ?? [];
    const projectValue = getCommercialProjectValue(project);
    const projectHours = project.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const employeeProjectEntries = project.timeEntries.filter((entry) => entry.userId === employee.id);
    const employeeProjectHours = employeeProjectEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const employeeProjectBillableHours = employeeProjectEntries
      .filter((entry) => entry.isBillable)
      .reduce((sum, entry) => sum + entry.hours, 0);

    const totalProjectTaskCount = taskState?.tasks.length ?? 0;
    const employeeTaskCount = employeeTasks.length;
    const employeeShare =
      projectHours > 0
        ? clamp(employeeProjectHours / projectHours, 0, 1)
        : totalProjectTaskCount > 0
          ? clamp(employeeTaskCount / totalProjectTaskCount, 0, 1)
          : project.assignments.some((assignment) => assignment.userId === employee.id)
            ? clamp(1 / Math.max(project.assignments.length, 1), 0, 1)
            : 0;
    const employeeProjectRevenue = round2(projectValue * employeeShare);

    const allTaskWeights = employeeTasks.map((item) =>
      getTaskAllocationWeight({
        task: item.task,
        employeeId: employee.id,
        range,
        completionDate: item.completionDate,
      })
    );
    const totalWeight = allTaskWeights.reduce((sum, value) => sum + value, 0);
    const visibleTasks = employeeTasks.filter((item) =>
      taskMatchesSelectedRange({
        task: item.task,
        employeeId: employee.id,
        range,
        completionDate: item.completionDate,
      })
    );

    const completedInProject = visibleTasks.filter(
      (item) => getTaskCompletionPercent(item.task) >= 100
    ).length;
    const pendingInProject = Math.max(0, visibleTasks.length - completedInProject);

    totalHours += employeeProjectHours;
    billableHours += employeeProjectBillableHours;
    totalRevenue += employeeProjectRevenue;
    totalTasks += visibleTasks.length;
    completedTasks += completedInProject;

    projectRows.push({
      id: project.id,
      name: project.name,
      code: project.code,
      status: getDisplayProjectStatus(project.status),
      rawStatus: project.status,
      deadline: toIsoString(project.deadline),
      totalTasks: visibleTasks.length,
      completedTasks: completedInProject,
      pendingTasks: pendingInProject,
      timeSpentHours: round2(employeeProjectHours),
      revenue: employeeProjectRevenue,
      totalProjectValue: round2(projectValue),
    });

    taskCompletionChart.push({
      label: project.name,
      completed: completedInProject,
      pending: pendingInProject,
    });

    if (employeeProjectRevenue > 0) {
      projectContributionChart.push({
        label: project.name,
        value: employeeProjectRevenue,
      });
    }

    if (employeeProjectHours > 0 && employeeProjectRevenue > 0) {
      const employeeHoursByDay = new Map<string, number>();

      for (const entry of employeeProjectEntries) {
        const bucketKey = getBucketKey(entry.date);
        if (!bucketKey || !performanceTrendMap.has(bucketKey)) {
          continue;
        }

        employeeHoursByDay.set(bucketKey, (employeeHoursByDay.get(bucketKey) ?? 0) + entry.hours);
        const performanceBucket = performanceTrendMap.get(bucketKey);
        if (performanceBucket) {
          performanceBucket.hours = round2(performanceBucket.hours + entry.hours);
        }
      }

      for (const [bucketKey, hours] of employeeHoursByDay.entries()) {
        const revenueBucket = revenueTrendMap.get(bucketKey);
        if (!revenueBucket || employeeProjectHours <= 0) {
          continue;
        }

        revenueBucket.revenue = round2(
          revenueBucket.revenue + employeeProjectRevenue * clamp(hours / employeeProjectHours, 0, 1)
        );
      }
    }

    employeeTasks.forEach((item, index) => {
      const weight = allTaskWeights[index] ?? 0;
      const allocatedHours =
        employeeProjectHours > 0 && totalWeight > 0 ? round2(employeeProjectHours * (weight / totalWeight)) : 0;
      const allocatedRevenue =
        employeeProjectRevenue > 0 && totalWeight > 0
          ? round2(employeeProjectRevenue * (weight / totalWeight))
          : 0;
      const rangeUpdateCount = item.task.updates.filter(
        (update) => update.byUserId === employee.id && isDateInRange(update.createdAt, range)
      ).length;
      const shouldDisplayTask = taskMatchesSelectedRange({
        task: item.task,
        employeeId: employee.id,
        range,
        completionDate: item.completionDate,
      });

      if (item.completionDate && isDateInRange(item.completionDate, range)) {
        const completionBucketKey = getBucketKey(item.completionDate);
        if (completionBucketKey) {
          const trendBucket = performanceTrendMap.get(completionBucketKey);
          if (trendBucket) {
            trendBucket.tasksCompleted += 1;
          }
        }
      }

      if (!shouldDisplayTask) {
        return;
      }

      taskRows.push({
        id: item.task.id,
        projectId: project.id,
        projectName: project.name,
        name: item.task.title,
        status: getTaskCompletionPercent(item.task) >= 100 ? "Completed" : "Pending",
        assignedDate: item.task.createdAt,
        completionDate: item.completionDate,
        dueDate: item.task.dueDate ?? null,
        timeTakenHours: allocatedHours,
        revenue: allocatedRevenue,
        updateCount: rangeUpdateCount,
      });
    });
  }

  const summary = {
    totalProjects: projectRows.length,
    ongoingProjects: projectRows.filter((project) => project.status === "Ongoing").length,
    totalTasks,
    completedTasks,
    pendingTasks: Math.max(0, totalTasks - completedTasks),
    totalHours: round2(totalHours),
    billableHours: round2(billableHours),
    billableShare: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    totalRevenue: round2(totalRevenue),
  };

  projectRows.sort(
    (left, right) =>
      right.revenue - left.revenue ||
      right.timeSpentHours - left.timeSpentHours ||
      right.pendingTasks - left.pendingTasks ||
      left.name.localeCompare(right.name)
  );

  taskRows.sort((left, right) => {
    const rightDate = new Date(right.completionDate ?? right.assignedDate).getTime();
    const leftDate = new Date(left.completionDate ?? left.assignedDate).getTime();

    return (
      Number(right.status === "Completed") - Number(left.status === "Completed") ||
      rightDate - leftDate ||
      right.revenue - left.revenue ||
      left.name.localeCompare(right.name)
    );
  });

  return {
    range: range.range,
    rangeLabel: range.label,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      position: employee.position,
      phone: employee.phone,
      joinDate: toIsoString(employee.hireDate),
      status: employee.isActive ? "Active" : "Inactive",
    },
    summary,
    projects: projectRows,
    tasks: taskRows,
    charts: {
      taskCompletion: taskCompletionChart.filter((item) => item.completed > 0 || item.pending > 0),
      performanceTrend: Array.from(performanceTrendMap.values()),
      projectContribution: projectContributionChart
        .sort((left, right) => right.value - left.value)
        .slice(0, 8),
      revenueTrend: Array.from(revenueTrendMap.values()),
    },
    changes: {
      summary: changeSummary,
      items: changeItems,
    },
    notes: [
      "Task time and revenue are inferred from project-level work logs and commercial value because tasks are not tracked with direct hour or amount fields.",
      "The selected date anchors the daily, weekly, or monthly period shown in the dashboard, including task activity, completion, and current open assignments.",
    ],
  };
}
