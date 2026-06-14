import "server-only";

import { db } from "@/lib/db";
import type { Role } from "@prisma/client";
import {
  getCrmAllowedCreatorIds as resolveCrmAllowedCreatorIds,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";

export async function getCrmTeamMemberIds(userId: string, role: Role | string) {
  const ids = new Set<string>([userId]);

  if (role === "BA") {
    const rows = await db.projectAssignment.findMany({
      where: {
        isActive: true,
        project: { managerId: userId },
      },
      select: { userId: true },
    });
    for (const row of rows) ids.add(row.userId);
    return Array.from(ids);
  }

  if (role === "TEAMLEADER" || role === "EMPLOYEE") {
    const projectLinks = await db.projectAssignment.findMany({
      where: { userId, isActive: true },
      select: { projectId: true },
    });

    if (projectLinks.length === 0) {
      return Array.from(ids);
    }

    const projectIds = projectLinks.map((item) => item.projectId);
    const teamRows = await db.projectAssignment.findMany({
      where: {
        isActive: true,
        projectId: { in: projectIds },
      },
      select: { userId: true },
    });

    for (const row of teamRows) ids.add(row.userId);
    return Array.from(ids);
  }

  return Array.from(ids);
}

export async function getCrmAllowedCreatorIds(
  userId: string,
  role: Role | string,
  permissions: unknown
) {
  const normalized = normalizeEmployeePermissions(permissions);
  const needsTeamMembers =
    normalized.recordRules.includes("TEAM_RECORD") ||
    normalized.recordRules.includes("ASSIGN_PROJECT");

  const teamMemberIds = needsTeamMembers ? await getCrmTeamMemberIds(userId, role) : [];
  return resolveCrmAllowedCreatorIds(userId, role, normalized, teamMemberIds);
}
