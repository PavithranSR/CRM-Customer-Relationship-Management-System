import { Priority, ProjectStatus, Role } from "@prisma/client";
import { format } from "date-fns";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { getTaskCompletionPercent, normalizeTask } from "@/lib/project-task-utils";
import { ScheduleAiPlanner } from "@/components/schedule/schedule-ai-planner";

const DEFAULT_CAPACITY_HOURS_PER_DAY = 6;
const DEFAULT_HOURS_PER_TASK = 6;
const RECENT_DAYS_FOR_CAPACITY = 14;

type ProjectTaskStateMetadata = {
  tasks?: unknown[];
};

type CapacityTracker = {
  totalHours: number;
  days: Set<string>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getPriorityWeight(priority: Priority) {
  if (priority === "CRITICAL") return 4;
  if (priority === "HIGH") return 3;
  if (priority === "MEDIUM") return 2;
  return 1;
}

function getWorkingDaysBetween(from: Date, to: Date) {
  const start = new Date(from);
  const end = new Date(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function addWorkingDays(from: Date, days: number) {
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  if (days <= 0) return cursor;

  let remaining = days;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return cursor;
}

export default async function SchedulePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const viewerWhere = buildProjectWhereForViewer({
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });

  const today = new Date();
  const recentFrom = new Date(today);
  recentFrom.setDate(today.getDate() - RECENT_DAYS_FOR_CAPACITY);

  const fallbackSnapshot = {
    liveTasks: 0,
    liveOpenTasks: 0,
    liveCompletedTasks: 0,
    liveEmployees: 0,
    liveTeamLeaders: 0,
    activeProjects: 0,
    onTrackProjects: 0,
    atRiskProjects: 0,
    liveRemainingHours: 0,
    liveCapacityPerDay: 0,
    suggestedCompletionDays: 0,
    suggestedCompletionDate: format(today, "MMM d, yyyy"),
    availableBAs: 0,
    availableTeamLeaders: 0,
    availableEmployees: 0,
    avgEmployeeCapacityPerDay: DEFAULT_CAPACITY_HOURS_PER_DAY,
    recommendedTeams: 1,
    recommendedTeamSize: 1,
  };

  let snapshot = fallbackSnapshot;
  let revenueQueue: Array<{
    id: string;
    name: string;
    code: string;
    revenue: number;
    priority: Priority;
    status: ProjectStatus;
    totalTasks: number;
    openTasks: number;
    remainingHours: number;
    assignedEmployees: number;
    onTrack: boolean;
  }> = [];
  let dataUnavailableReason: string | undefined;

  try {
    const projects = await db.project.findMany({
      where: {
        ...viewerWhere,
        status: {
          in: [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS, ProjectStatus.ON_HOLD],
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        priority: true,
        status: true,
        estimatedHours: true,
        actualHours: true,
        deadline: true,
        finalAmount: true,
        subtotalAmount: true,
        profitAmount: true,
        unitCount: true,
        unitPrice: true,
        assignments: {
          where: { isActive: true },
          select: {
            userId: true,
            user: { select: { name: true, role: true } },
          },
        },
        timeEntries: {
          where: {
            date: {
              gte: recentFrom,
            },
          },
          select: {
            userId: true,
            date: true,
            hours: true,
          },
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
    });

    const workforce = await db.user.findMany({
      where: {
        isActive: true,
        role: {
          in: [Role.BA, Role.TEAMLEADER, Role.EMPLOYEE],
        },
      },
      select: {
        id: true,
        role: true,
        timeEntries: {
          where: {
            date: {
              gte: recentFrom,
            },
          },
          select: {
            date: true,
            hours: true,
          },
        },
      },
    });

    const projectIds = projects.map((project) => project.id);
    const taskLogs = projectIds.length
      ? await db.activityLog.findMany({
          where: {
            entityType: "project_task_state",
            projectId: { in: projectIds },
          },
          orderBy: { createdAt: "desc" },
          select: {
            projectId: true,
            metadata: true,
          },
        })
      : [];

    const latestTaskStateByProject = new Map<string, unknown[]>();
    for (const log of taskLogs) {
      if (!log.projectId || latestTaskStateByProject.has(log.projectId)) continue;
      const metadata = (log.metadata as ProjectTaskStateMetadata | null) ?? null;
      const rawTasks = Array.isArray(metadata?.tasks) ? metadata.tasks : [];
      latestTaskStateByProject.set(log.projectId, rawTasks);
    }

    const userCapacity = new Map<string, CapacityTracker>();
    for (const project of projects) {
      for (const entry of project.timeEntries) {
        const current = userCapacity.get(entry.userId) ?? {
          totalHours: 0,
          days: new Set<string>(),
        };
        current.totalHours += entry.hours;
        current.days.add(format(new Date(entry.date), "yyyy-MM-dd"));
        userCapacity.set(entry.userId, current);
      }
    }

    const employeeCapacityPerDay = new Map<string, number>();
    for (const [userId, tracker] of userCapacity.entries()) {
      const avg = tracker.days.size > 0 ? tracker.totalHours / tracker.days.size : DEFAULT_CAPACITY_HOURS_PER_DAY;
      employeeCapacityPerDay.set(userId, clamp(avg, 2, 8));
    }

    const allEmployeeIds = new Set<string>();
    const allTeamLeadIds = new Set<string>();

    const rows = projects.map((project) => {
    const rawTasks = latestTaskStateByProject.get(project.id) ?? [];
    const tasks = rawTasks.map((task) => normalizeTask(task)).filter((task): task is NonNullable<typeof task> => Boolean(task));
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((task) => getTaskCompletionPercent(task) >= 100).length;
    const openTasks = Math.max(0, totalTasks - completedTasks);

    const taskCompletionAvg =
      totalTasks > 0
        ? tasks.reduce((sum, task) => sum + getTaskCompletionPercent(task), 0) / totalTasks
        : 0;

    const employees = project.assignments.filter((assignment) => assignment.user.role === Role.EMPLOYEE);
    const teamLeads = project.assignments.filter((assignment) => assignment.user.role === Role.TEAMLEADER);

    employees.forEach((assignment) => allEmployeeIds.add(assignment.userId));
    teamLeads.forEach((assignment) => allTeamLeadIds.add(assignment.userId));

    const assignedEmployees = employees.length;
    const assignedCapacityPerDay = Math.max(
      1,
      employees.reduce(
        (sum, assignment) => sum + (employeeCapacityPerDay.get(assignment.userId) ?? DEFAULT_CAPACITY_HOURS_PER_DAY),
        0
      )
    );

    const estimatedHours =
      project.estimatedHours ??
      (totalTasks > 0 ? totalTasks * DEFAULT_HOURS_PER_TASK : DEFAULT_HOURS_PER_TASK * 2);
    const inferredCompletedHours = (estimatedHours * taskCompletionAvg) / 100;
    const consumedHours = Math.max(project.actualHours ?? 0, inferredCompletedHours);
    const remainingHours = Math.max(0, estimatedHours - consumedHours);

    const deadline = project.deadline ?? addWorkingDays(today, 10);
    const workingDaysLeft = Math.max(1, getWorkingDaysBetween(today, deadline));
    const daysNeeded = Math.max(1, Math.ceil(remainingHours / assignedCapacityPerDay));
    const onTrack = daysNeeded <= workingDaysLeft;

    const revenue =
      project.finalAmount ??
      project.subtotalAmount ??
      project.profitAmount ??
      ((project.unitCount ?? 0) * (project.unitPrice ?? 0));

    return {
      id: project.id,
      name: project.name,
      code: project.code,
      revenue: revenue ?? 0,
      priority: project.priority,
      status: project.status,
      totalTasks,
      openTasks,
      remainingHours,
      assignedEmployees,
      onTrack,
      priorityWeight: getPriorityWeight(project.priority),
    };
    });

    rows.sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      if (b.priorityWeight !== a.priorityWeight) return b.priorityWeight - a.priorityWeight;
      return b.openTasks - a.openTasks;
    });

    const liveTasks = rows.reduce((sum, row) => sum + row.totalTasks, 0);
    const liveOpenTasks = rows.reduce((sum, row) => sum + row.openTasks, 0);
    const liveCompletedTasks = Math.max(0, liveTasks - liveOpenTasks);
    const liveRemainingHours = rows.reduce((sum, row) => sum + row.remainingHours, 0);
    const liveCapacityPerDay = rows.reduce((sum, row) => sum + row.assignedEmployees * DEFAULT_CAPACITY_HOURS_PER_DAY, 0);
    const suggestedCompletionDays =
      liveCapacityPerDay > 0 ? Math.ceil(liveRemainingHours / liveCapacityPerDay) : 0;
    const suggestedCompletionDate = addWorkingDays(today, suggestedCompletionDays);
    const onTrackProjects = rows.filter((row) => row.onTrack).length;
    const atRiskProjects = Math.max(0, rows.length - onTrackProjects);

    snapshot = {
      liveTasks,
      liveOpenTasks,
      liveCompletedTasks,
      liveEmployees: allEmployeeIds.size,
      liveTeamLeaders: allTeamLeadIds.size,
      activeProjects: rows.length,
      onTrackProjects,
      atRiskProjects,
      liveRemainingHours,
      liveCapacityPerDay,
      suggestedCompletionDays,
      suggestedCompletionDate: format(suggestedCompletionDate, "MMM d, yyyy"),
      availableBAs: workforce.filter((user) => user.role === Role.BA).length,
      availableTeamLeaders: workforce.filter((user) => user.role === Role.TEAMLEADER).length,
      availableEmployees: workforce.filter((user) => user.role === Role.EMPLOYEE).length,
      avgEmployeeCapacityPerDay: (() => {
        const employees = workforce.filter((user) => user.role === Role.EMPLOYEE);
        if (employees.length === 0) return DEFAULT_CAPACITY_HOURS_PER_DAY;
        const avgByEmployee = employees.map((employee) => {
          const hours = employee.timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
          const days = new Set(employee.timeEntries.map((entry) => format(new Date(entry.date), "yyyy-MM-dd"))).size;
          const avg = days > 0 ? hours / days : DEFAULT_CAPACITY_HOURS_PER_DAY;
          return clamp(avg, 2, 8);
        });
        return avgByEmployee.reduce((sum, value) => sum + value, 0) / avgByEmployee.length;
      })(),
      recommendedTeams: (() => {
        const employees = workforce.filter((user) => user.role === Role.EMPLOYEE).length;
        const leaders = workforce.filter((user) => user.role === Role.TEAMLEADER).length;
        if (employees <= 0 || leaders <= 0) return 1;
        const bySize = Math.max(1, Math.ceil(employees / 6));
        return Math.max(1, Math.min(leaders, bySize));
      })(),
      recommendedTeamSize: (() => {
        const employees = workforce.filter((user) => user.role === Role.EMPLOYEE).length;
        const leaders = workforce.filter((user) => user.role === Role.TEAMLEADER).length;
        const teams = Math.max(1, Math.min(Math.max(1, leaders), Math.max(1, Math.ceil(employees / 6))));
        return Math.max(1, Math.ceil(Math.max(1, employees) / teams));
      })(),
    };

    revenueQueue = rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      revenue: row.revenue,
      priority: row.priority,
      status: row.status,
      totalTasks: row.totalTasks,
      openTasks: row.openTasks,
      remainingHours: row.remainingHours,
      assignedEmployees: row.assignedEmployees,
      onTrack: row.onTrack,
    }));
  } catch (error) {
    console.error("Schedule data load failed:", error);
    dataUnavailableReason = error instanceof Error ? error.message : "Database unavailable";
  }

  return (
    <ScheduleAiPlanner
      snapshot={snapshot}
      revenueQueue={revenueQueue}
      dataUnavailableReason={dataUnavailableReason}
    />
  );
}
