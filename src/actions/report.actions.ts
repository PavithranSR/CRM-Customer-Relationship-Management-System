"use server";

import { db } from "@/lib/db";
import { requireAuth, requireModuleAccess } from "@/lib/auth";
import { buildProjectWhereForViewer, normalizeEmployeePermissions } from "@/lib/employee-permissions";
import type { EmployeePermissions } from "@/lib/employee-permissions";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { Prisma } from "@prisma/client";

function shouldLimitToOwnRecords(permissions: unknown) {
  const normalized = normalizeEmployeePermissions(permissions);
  const rules = normalized.recordRules;
  if (rules.includes("RECORD_RULES")) {
    return false;
  }
  const hasTeamScope = rules.includes("TEAM_RECORD") || rules.includes("ASSIGN_PROJECT");
  return rules.includes("OWN_RECORD") && !hasTeamScope;
}

function buildTimeEntryWhere(input: {
  userId: string;
  role: string;
  permissions: EmployeePermissions | null | undefined;
  startDate: Date;
  endDate: Date;
  filterUserId?: string;
  filterProjectId?: string;
}) {
  const projectWhere = buildProjectWhereForViewer({
    userId: input.userId,
    role: input.role,
    permissions: input.permissions,
  });
  const ownOnly = input.role !== "ADMIN" && shouldLimitToOwnRecords(input.permissions);
  const where: Prisma.TimeEntryWhereInput = {
    date: { gte: input.startDate, lte: input.endDate },
    project: projectWhere,
    ...(input.filterProjectId && { projectId: input.filterProjectId }),
  };

  if (ownOnly) {
    where.userId = input.userId;
  } else if (input.filterUserId) {
    where.userId = input.filterUserId;
  }

  return where;
}

export async function getReportData(
  startDate: Date,
  endDate: Date,
  userId?: string,
  projectId?: string
) {
  const user = await requireAuth();
  await requireModuleAccess("PROJECT");

  const baseWhere = buildTimeEntryWhere({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
    startDate,
    endDate,
    filterUserId: userId,
    filterProjectId: projectId,
  });

  // Employee hours breakdown
  const employeeHours = await db.timeEntry.groupBy({
    by: ["userId"],
    where: baseWhere,
    _sum: { hours: true },
  });

  const employeeDetails = await db.user.findMany({
    where: { id: { in: employeeHours.map((e) => e.userId) } },
    select: { id: true, name: true, department: true },
  });

  const employeeHoursWithNames = employeeHours.map((e) => {
    const employee = employeeDetails.find((d) => d.id === e.userId);
    return {
      userId: e.userId,
      name: employee?.name || "Unknown",
      department: employee?.department,
      hours: e._sum.hours || 0,
    };
  });

  // Project hours breakdown
  const projectHours = await db.timeEntry.groupBy({
    by: ["projectId"],
    where: baseWhere,
    _sum: { hours: true },
  });

  const projectDetails = await db.project.findMany({
    where: { id: { in: projectHours.map((p) => p.projectId) } },
    select: { id: true, name: true, code: true, status: true, progress: true },
  });

  const projectHoursWithNames = projectHours.map((p) => {
    const project = projectDetails.find((d) => d.id === p.projectId);
    return {
      projectId: p.projectId,
      name: project?.name || "Unknown",
      code: project?.code || "",
      status: project?.status,
      progress: project?.progress,
      hours: p._sum.hours || 0,
    };
  });

  // Daily hours trend
  const dailyHours = await db.timeEntry.groupBy({
    by: ["date"],
    where: baseWhere,
    _sum: { hours: true },
    orderBy: { date: "asc" },
  });

  const dailyTrend = dailyHours.map((d) => ({
    date: format(new Date(d.date), "MMM d"),
    hours: d._sum.hours || 0,
  }));

  // Monthly comparison (last 6 months)
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = endOfMonth(subMonths(new Date(), i));
    const monthWhere = buildTimeEntryWhere({
      userId: user.id,
      role: user.role,
      permissions: user.permissions,
      startDate: monthStart,
      endDate: monthEnd,
      filterProjectId: projectId,
    });

    const monthHours = await db.timeEntry.aggregate({
      where: monthWhere,
      _sum: { hours: true },
    });

    monthlyData.push({
      month: format(monthStart, "MMM yyyy"),
      hours: monthHours._sum.hours || 0,
    });
  }

  // Total summary
  const totalHours = await db.timeEntry.aggregate({
    where: baseWhere,
    _sum: { hours: true },
  });

  const billableHours = await db.timeEntry.aggregate({
    where: { ...baseWhere, isBillable: true },
    _sum: { hours: true },
  });

  return {
    employeeHours: employeeHoursWithNames,
    projectHours: projectHoursWithNames,
    dailyTrend,
    monthlyData,
    summary: {
      totalHours: totalHours._sum.hours || 0,
      billableHours: billableHours._sum.hours || 0,
      billablePercentage: totalHours._sum.hours
        ? Math.round(((billableHours._sum.hours || 0) / totalHours._sum.hours) * 100)
        : 0,
    },
  };
}

export async function exportReportCSV(
  startDate: Date,
  endDate: Date,
  type: "employee-hours" | "project-hours" | "detailed"
) {
  const user = await requireAuth();
  await requireModuleAccess("PROJECT");
  const where = buildTimeEntryWhere({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
    startDate,
    endDate,
  });

  const entries = await db.timeEntry.findMany({
    where,
    include: {
      user: { select: { name: true, email: true, department: true } },
      project: { select: { name: true, code: true } },
    },
    orderBy: { date: "asc" },
  });

  let csv = "";

  if (type === "employee-hours") {
    // Aggregate by employee
    const aggregated: Record<string, { name: string; department: string | null; hours: number }> = {};
    entries.forEach((e) => {
      if (!aggregated[e.userId]) {
        aggregated[e.userId] = { name: e.user.name, department: e.user.department, hours: 0 };
      }
      aggregated[e.userId].hours += e.hours;
    });

    csv = "Employee,Department,Total Hours\n";
    Object.values(aggregated).forEach((row) => {
      csv += `"${row.name}","${row.department || ""}",${row.hours.toFixed(2)}\n`;
    });
  } else if (type === "project-hours") {
    // Aggregate by project
    const aggregated: Record<string, { name: string; code: string; hours: number }> = {};
    entries.forEach((e) => {
      if (!aggregated[e.projectId]) {
        aggregated[e.projectId] = { name: e.project.name, code: e.project.code, hours: 0 };
      }
      aggregated[e.projectId].hours += e.hours;
    });

    csv = "Project,Code,Total Hours\n";
    Object.values(aggregated).forEach((row) => {
      csv += `"${row.name}","${row.code}",${row.hours.toFixed(2)}\n`;
    });
  } else {
    // Detailed export
    csv = "Date,Employee,Project,Hours,Description,Billable\n";
    entries.forEach((e) => {
      csv += `"${format(new Date(e.date), "yyyy-MM-dd")}","${e.user.name}","${e.project.name}",${e.hours},"${e.description || ""}",${e.isBillable ? "Yes" : "No"}\n`;
    });
  }

  return csv;
}
