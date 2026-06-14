"use server";

import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireAuth,
  requireProjectRecordAccess,
} from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";

interface CommentAuthor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface CommentNode {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: string;
  author: CommentAuthor;
  replies: CommentNode[];
}

interface CommentLogRecord {
  id: string;
  createdAt: Date;
  createdBy: CommentAuthor;
  metadata: unknown;
}

function isDatabaseConnectionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P1001" || error.code === "P2024")
  );
}

function parseCommentMetadata(value: unknown): { commentId: string; parentId: string | null; text: string } | null {
  if (!value || typeof value !== "object") return null;
  const metadata = value as Record<string, unknown>;

  const commentId = typeof metadata.commentId === "string" ? metadata.commentId : "";
  const parentIdRaw = metadata.parentId;
  const parentId = typeof parentIdRaw === "string" && parentIdRaw.length > 0 ? parentIdRaw : null;
  const text = typeof metadata.text === "string" ? metadata.text.trim() : "";

  if (!commentId || !text) return null;
  return { commentId, parentId, text };
}

function buildCommentTree(logs: CommentLogRecord[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const log of logs) {
    const parsed = parseCommentMetadata(log.metadata);
    if (!parsed) continue;

    byId.set(parsed.commentId, {
      id: parsed.commentId,
      parentId: parsed.parentId,
      text: parsed.text,
      createdAt: log.createdAt.toISOString(),
      author: log.createdBy,
      replies: [],
    });
  }

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortDeep = (items: CommentNode[]) => {
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (const item of items) sortDeep(item.replies);
  };
  sortDeep(roots);

  return roots;
}

async function ensureProjectAccess(projectId: string) {
  const user = await requireAuth();

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      managerId: true,
      assignments: {
        where: { isActive: true },
        select: { userId: true },
      },
    },
  });

  if (!project) {
    return { error: "Project not found" as const };
  }
  try {
    await requireProjectRecordAccess(projectId);
  } catch {
    return { error: "Forbidden" as const };
  }

  const isAssigned = project.assignments.some((assignment) => assignment.userId === user.id);
  const isManagerBa = user.role === "BA" && project.managerId === user.id;
  const canView =
    user.role === "ADMIN" ||
    isManagerBa ||
    ((user.role === "TEAMLEADER" || user.role === "EMPLOYEE") && isAssigned);

  if (!canView) {
    return { error: "Forbidden" as const };
  }

  return { user };
}

async function getRawCommentLogs(projectId: string, entityType: "project_comment" | "task_comment", entityId: string) {
  return db.activityLog.findMany({
    where: {
      projectId,
      entityType,
      entityId,
      action: "CREATE",
    },
    orderBy: { createdAt: "asc" },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}

export async function getProjectComments(projectId: string) {
  try {
    const access = await ensureProjectAccess(projectId);
    if ("error" in access) return { error: access.error, data: [] as CommentNode[] };

    const logs = await getRawCommentLogs(projectId, "project_comment", projectId);
    return { data: buildCommentTree(logs) };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { data: [] as CommentNode[] };
    }
    throw error;
  }
}

export async function addProjectComment(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const text = String(formData.get("text") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || null;

  if (!projectId || !text) {
    return { error: "Project and comment are required" };
  }
  try {
    await requireActionPermission("UPDATE", "PROJECT");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  try {
    const access = await ensureProjectAccess(projectId);
    if ("error" in access) return { error: access.error };
    const { user } = access;

    const commentId = crypto.randomUUID();

    await db.activityLog.create({
      data: {
        action: "CREATE",
        entityType: "project_comment",
        entityId: projectId,
        projectId,
        userId: user.id,
        createdById: user.id,
        metadata: {
          commentId,
          parentId,
          text,
        },
      },
    });

    const logs = await getRawCommentLogs(projectId, "project_comment", projectId);
    return { success: true, data: buildCommentTree(logs) };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { error: "Comments are temporarily unavailable. Please try again shortly." };
    }
    throw error;
  }
}

export async function getTaskComments(projectId: string, taskId: string) {
  if (!projectId || !taskId) {
    return { error: "Project and task are required", data: [] as CommentNode[] };
  }

  try {
    const access = await ensureProjectAccess(projectId);
    if ("error" in access) return { error: access.error, data: [] as CommentNode[] };

    const logs = await getRawCommentLogs(projectId, "task_comment", taskId);
    return { data: buildCommentTree(logs) };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { data: [] as CommentNode[] };
    }
    throw error;
  }
}

export async function addTaskComment(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const taskId = String(formData.get("taskId") || "");
  const text = String(formData.get("text") || "").trim();
  const parentId = String(formData.get("parentId") || "").trim() || null;

  if (!projectId || !taskId || !text) {
    return { error: "Project, task, and comment are required" };
  }
  try {
    await requireActionPermission("UPDATE", "PROJECT");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  try {
    const access = await ensureProjectAccess(projectId);
    if ("error" in access) return { error: access.error };
    const { user } = access;

    const commentId = crypto.randomUUID();

    await db.activityLog.create({
      data: {
        action: "CREATE",
        entityType: "task_comment",
        entityId: taskId,
        projectId,
        userId: user.id,
        createdById: user.id,
        metadata: {
          commentId,
          parentId,
          text,
        },
      },
    });

    const logs = await getRawCommentLogs(projectId, "task_comment", taskId);
    return { success: true, data: buildCommentTree(logs) };
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return { error: "Task comments are temporarily unavailable. Please try again shortly." };
    }
    throw error;
  }
}
