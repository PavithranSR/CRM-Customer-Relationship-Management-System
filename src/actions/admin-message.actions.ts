"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma, Role } from "@prisma/client";

const allowedTargetsBySender: Record<string, string[]> = {
  ADMIN: ["ALL", "TEAMLEADER", "BA", "EMPLOYEE"],
  BA: ["ALL", "TEAMLEADER", "EMPLOYEE"],
  TEAMLEADER: ["ALL", "EMPLOYEE"],
};

export async function sendAdminMessage(formData: FormData) {
  const user = await requireAuth();

  const targetRole = String(formData.get("targetRole") || "ALL").trim().toUpperCase();
  const message = String(formData.get("message") || "").trim();

  if (user.role === "EMPLOYEE") {
    return { error: "Employees cannot send messages." };
  }

  const allowedTargets = allowedTargetsBySender[user.role] ?? [];
  if (!allowedTargets.includes(targetRole)) {
    return { error: "Invalid target role" };
  }

  if (!message) {
    return { error: "Message is required" };
  }

  let recipientIds: string[] = [];

  try {
    if (user.role === "ADMIN") {
      const roleFilter: Role | Prisma.EnumRoleFilter<"User"> =
        targetRole === "ALL"
          ? { in: ["ADMIN", "BA", "TEAMLEADER", "EMPLOYEE"] as const }
          : (targetRole as Role);

      const users = await db.user.findMany({
        where: {
          isActive: true,
          role: roleFilter,
          id: { not: user.id },
        },
        select: { id: true },
      });
      recipientIds = users.map((item) => item.id);
    } else if (user.role === "BA") {
      const managedProjects = await db.project.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const projectIds = managedProjects.map((project) => project.id);
      if (projectIds.length === 0) {
        return { error: "No managed projects found to send messages." };
      }

      const assignments = await db.projectAssignment.findMany({
        where: {
          projectId: { in: projectIds },
          isActive: true,
        },
        include: {
          user: { select: { id: true, role: true, isActive: true } },
        },
      });

      const allowedRecipientRoles =
        targetRole === "ALL"
          ? new Set(["TEAMLEADER", "EMPLOYEE"])
          : new Set([targetRole]);

      recipientIds = Array.from(
        new Set(
          assignments
            .map((item) => item.user)
            .filter(
              (employee) =>
                employee.isActive &&
                employee.id !== user.id &&
                allowedRecipientRoles.has(employee.role)
            )
            .map((employee) => employee.id)
        )
      );
    } else if (user.role === "TEAMLEADER") {
      const tlAssignments = await db.projectAssignment.findMany({
        where: { userId: user.id, isActive: true },
        select: { projectId: true },
      });
      const projectIds = Array.from(new Set(tlAssignments.map((item) => item.projectId)));
      if (projectIds.length === 0) {
        return { error: "No team projects found to send messages." };
      }

      const assignments = await db.projectAssignment.findMany({
        where: {
          projectId: { in: projectIds },
          isActive: true,
        },
        include: {
          user: { select: { id: true, role: true, isActive: true } },
        },
      });

      recipientIds = Array.from(
        new Set(
          assignments
            .map((item) => item.user)
            .filter(
              (employee) =>
                employee.isActive &&
                employee.id !== user.id &&
                employee.role === "EMPLOYEE"
            )
            .map((employee) => employee.id)
        )
      );
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P2024")
    ) {
      return { error: "Database is temporarily unavailable. Please try again." };
    }
    return { error: "Could not send message right now. Please try again." };
  }

  if (recipientIds.length === 0) {
    return { error: "No recipients found for selected filter." };
  }

  try {
    const messageId = crypto.randomUUID();
    await db.activityLog.createMany({
      data: recipientIds.map((recipientId) => ({
        action: "CREATE",
        entityType: "role_message",
        entityId: messageId,
        userId: recipientId,
        createdById: user.id,
        metadata: {
          targetRole,
          message,
          senderRole: user.role,
        },
      })),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P1001" || error.code === "P2024")
    ) {
      return { error: "Database is temporarily unavailable. Please try again." };
    }
    return { error: "Could not send message right now. Please try again." };
  }

  revalidatePath("/dashboard");
  return { success: true, count: recipientIds.length };
}
