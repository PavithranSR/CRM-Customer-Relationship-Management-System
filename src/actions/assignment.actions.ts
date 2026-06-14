"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireActionPermission, requireProjectRecordAccess } from "@/lib/auth";
import { assignEmployeeSchema, assignTeamSchema } from "@/lib/validations/assignment.schema";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { logActivity } from "./activity-log.actions";

async function authorizeProjectAssignment(projectId: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");
  await requireProjectRecordAccess(projectId);

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, managerId: true, type: true, status: true },
  });

  if (!project) {
    return { error: "Project not found" as const };
  }

  const canAssign = user.role === "ADMIN";

  if (!canAssign) {
    return { error: "Only admin can manage project members" as const };
  }

  if (project.status === "COMPLETED") {
    return { error: "Completed projects cannot be modified" as const };
  }

  return { user, project };
}

export async function getAvailableEmployees(projectId: string) {
  const auth = await authorizeProjectAssignment(projectId);
  if ("error" in auth) return [];

  const candidates = await db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["TEAMLEADER", "EMPLOYEE"] },
      assignments: {
        none: {
          projectId,
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      permissions: true,
    },
  });

  return candidates
    .filter((candidate) =>
      normalizeEmployeePermissions(candidate.permissions).moduleAccess.includes("PROJECT")
    )
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      role: candidate.role,
      department: candidate.department,
    }));
}

export async function assignEmployee(formData: FormData) {
  const validatedFields = assignEmployeeSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    role: formData.get("role") || undefined,
    hoursAllocated: formData.get("hoursAllocated") || undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { projectId, userId, role, hoursAllocated } = validatedFields.data;
  const auth = await authorizeProjectAssignment(projectId);
  if ("error" in auth) return { error: auth.error };
  const { user, project } = auth;

  const assignee = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, name: true, permissions: true },
  });

  const canAssignRole =
    assignee &&
    (assignee.role === "EMPLOYEE" || assignee.role === "TEAMLEADER");

  if (!canAssignRole) {
    return { error: "Only TEAMLEADER or EMPLOYEE can be assigned" };
  }

  const hasProjectAccess = assignee
    ? normalizeEmployeePermissions(assignee.permissions).moduleAccess.includes("PROJECT")
    : false;

  if (!hasProjectAccess) {
    return { error: "Selected user does not have Projects module access" };
  }

  if (project.type === "INDIVIDUAL") {
    const activeAssignments = await db.projectAssignment.count({
      where: { projectId, isActive: true },
    });

    const isAlreadyAssigned = await db.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { isActive: true },
    });

    if (activeAssignments >= 1 && !isAlreadyAssigned?.isActive) {
      return { error: "Individual projects can have only one assigned team member" };
    }
  }

  // Check if assignment already exists
  const existing = await db.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (existing) {
    if (existing.isActive) {
      return { error: "Employee is already assigned to this project" };
    }
    // Reactivate the assignment
    await db.projectAssignment.update({
      where: { id: existing.id },
      data: { isActive: true, role, hoursAllocated, assignedAt: new Date(), unassignedAt: null },
    });
  } else {
    await db.projectAssignment.create({
      data: { projectId, userId, role, hoursAllocated },
    });
  }

  await logActivity({
    action: "ASSIGN",
    entityType: "project",
    entityId: projectId,
    userId,
    createdById: user.id,
    metadata: { employeeName: assignee.name, role, projectName: project.name },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

export async function assignTeam(formData: FormData) {
  const userIds = formData.getAll("userIds") as string[];

  const validatedFields = assignTeamSchema.safeParse({
    projectId: formData.get("projectId"),
    userIds,
    role: formData.get("role") || undefined,
  });

  if (!validatedFields.success) {
    return { error: validatedFields.error.flatten().fieldErrors };
  }

  const { projectId, role } = validatedFields.data;
  const auth = await authorizeProjectAssignment(projectId);
  if ("error" in auth) return { error: auth.error };
  const { user, project } = auth;

  if (project.type !== "TEAM") {
    return { error: "Team assignment is only allowed for TEAM projects" };
  }

  const normalizedUserIds = Array.from(new Set(userIds));
  const eligibleUserIds: string[] = [];

  for (const userId of normalizedUserIds) {
    const assignee = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true },
    });

    const hasRole =
      assignee && (assignee.role === "EMPLOYEE" || assignee.role === "TEAMLEADER");
    const hasProjectAccess = assignee
      ? normalizeEmployeePermissions(assignee.permissions).moduleAccess.includes("PROJECT")
      : false;
    if (!hasRole || !hasProjectAccess) {
      continue;
    }
    eligibleUserIds.push(userId);
  }

  if (eligibleUserIds.length === 0) {
    return { error: "Selected team has no assignable members" };
  }

  // BA assignment should represent exactly one selected team on the project.
  // Remove active project members that are not part of this selected team.
  if (user.role === "BA") {
    await db.projectAssignment.updateMany({
      where: {
        projectId,
        isActive: true,
        userId: { notIn: eligibleUserIds },
      },
      data: { isActive: false, unassignedAt: new Date() },
    });
  }

  for (const userId of eligibleUserIds) {
    const assignee = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true },
    });

    const hasRole =
      assignee && (assignee.role === "EMPLOYEE" || assignee.role === "TEAMLEADER");
    const hasProjectAccess = assignee
      ? normalizeEmployeePermissions(assignee.permissions).moduleAccess.includes("PROJECT")
      : false;

    if (!hasRole || !hasProjectAccess) {
      continue;
    }

    const existing = await db.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (existing) {
      if (!existing.isActive) {
        await db.projectAssignment.update({
          where: { id: existing.id },
          data: { isActive: true, role, assignedAt: new Date(), unassignedAt: null },
        });
      }
    } else {
      await db.projectAssignment.create({
        data: { projectId, userId, role },
      });
    }
  }

  const assignees = await db.user.findMany({
    where: { id: { in: eligibleUserIds } },
    select: { id: true, name: true },
  });

  for (const assignee of assignees) {
    await logActivity({
      action: "ASSIGN",
      entityType: "project",
      entityId: projectId,
      userId: assignee.id,
      createdById: user.id,
      metadata: {
        employeeName: assignee.name,
        role,
        projectName: project.name,
        assignmentMode: "TEAM",
      },
    });
  }

  await logActivity({
    action: "ASSIGN",
    entityType: "project",
    entityId: projectId,
    createdById: user.id,
    metadata: { teamSize: eligibleUserIds.length, role, projectName: project.name, assignmentMode: "TEAM" },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { success: true };
}

export async function unassignEmployee(assignmentId: string) {
  const user = await requireActionPermission("UPDATE", "PROJECT");

  const assignment = await db.projectAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      user: { select: { name: true } },
      project: { select: { id: true, managerId: true, status: true } },
    },
  });

  if (!assignment) {
    return { error: "Assignment not found" };
  }
  await requireProjectRecordAccess(assignment.projectId);

  const canAssign = user.role === "ADMIN";

  if (!canAssign) {
    return { error: "Only admin can manage project members" };
  }

  if (assignment.project.status === "COMPLETED") {
    return { error: "Completed projects cannot be modified" };
  }

  await db.projectAssignment.update({
    where: { id: assignmentId },
    data: { isActive: false, unassignedAt: new Date() },
  });

  await logActivity({
    action: "UNASSIGN",
    entityType: "project",
    entityId: assignment.projectId,
    userId: assignment.userId,
    createdById: user.id,
    metadata: { employeeName: assignment.user.name },
  });

  revalidatePath(`/projects/${assignment.projectId}`);
  revalidatePath("/projects");
  return { success: true };
}
