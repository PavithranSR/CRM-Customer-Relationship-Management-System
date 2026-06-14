"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  requireActionPermission,
  requireModuleAccess,
  requireProjectRecordAccess,
} from "@/lib/auth";
import { normalizeTask, type ProjectTask } from "@/lib/project-task-utils";
import type {
  MilestoneStatus,
  ProjectMilestone,
  ProjectSprint,
  SprintStageKey,
  SprintStatus,
  ProjectWorkflowState,
} from "@/lib/project-workflow-types";
import {
  getTaskMilestoneId,
  isProjectWorkflowComplete,
  isSprintWithinMilestoneWindow,
  isTaskWithinSprintWindow,
} from "@/lib/project-workflow-utils";
import { updateProjectStatus } from "./project.actions";

type ProjectWorkflowPayload = ProjectWorkflowState & {
  tasks: ProjectTask[];
  error?: string;
};

type ProjectWorkflowSelection = {
  milestoneId: string | null;
  sprintId: string | null;
};

type ProjectWorkflowSelectionPayload = ProjectWorkflowSelection & {
  error?: string;
};

const GLOBAL_MILESTONE_ENTITY_TYPE = "global_milestone_state";
const GLOBAL_MILESTONE_ENTITY_ID = "global";
const COMMON_MILESTONE_ENTITY_ID = "common_milestones";

function toJsonValue<T>(value: T) {
  return value as unknown as Prisma.InputJsonValue;
}

function getSharedMilestoneEntityId(projectId: string) {
  return `project:${projectId}:shared_milestones`;
}

function getCommonMilestoneEntityId() {
  return COMMON_MILESTONE_ENTITY_ID;
}

function normalizeDateString(value: unknown, fallback?: string) {
  const rawValue = typeof value === "string" ? value : fallback ?? "";
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString();
}

function normalizeSelectionId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeMilestoneStatus(value: unknown): MilestoneStatus {
  if (
    value === "NOT_STARTED" ||
    value === "IN_PROGRESS" ||
    value === "REACHED" ||
    value === "DELAYED"
  ) {
    return value;
  }
  return "NOT_STARTED";
}

function normalizeSprintStatus(value: unknown): SprintStatus {
  if (
    value === "PLANNED" ||
    value === "ACTIVE" ||
    value === "COMPLETED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  return "PLANNED";
}

function normalizeSprintStage(value: unknown): SprintStageKey {
  if (
    value === "BACKLOG" ||
    value === "TODO" ||
    value === "IN_PROGRESS" ||
    value === "REVIEW" ||
    value === "DONE"
  ) {
    return value;
  }
  return "BACKLOG";
}

function normalizeWorkflowSelection(value: unknown): ProjectWorkflowSelection {
  if (!value || typeof value !== "object") {
    return {
      milestoneId: null,
      sprintId: null,
    };
  }

  const raw = value as Record<string, unknown>;

  return {
    milestoneId: normalizeSelectionId(raw.milestoneId),
    sprintId: normalizeSelectionId(raw.sprintId),
  };
}

function normalizeMilestones(value: unknown): ProjectMilestone[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    const description = typeof raw.description === "string" ? raw.description.trim() : "";
    const createdAt = normalizeDateString(raw.createdAt, new Date().toISOString()) || new Date().toISOString();
    const updatedAt = normalizeDateString(raw.updatedAt, createdAt) || createdAt;
    const startDate =
      normalizeDateString(raw.startDate, createdAt) ||
      normalizeDateString(raw.targetDate, createdAt) ||
      createdAt;
    const targetDate = normalizeDateString(raw.targetDate, startDate);
    const ownerId = typeof raw.ownerId === "string" && raw.ownerId.trim() ? raw.ownerId.trim() : undefined;
    const ownerName =
      typeof raw.ownerName === "string" && raw.ownerName.trim() ? raw.ownerName.trim() : undefined;
    const taskLinks = Array.isArray(raw.taskLinks)
      ? raw.taskLinks.flatMap((link) => {
          if (!link || typeof link !== "object") {
            return [];
          }

          const rawLink = link as Record<string, unknown>;
          const taskId = typeof rawLink.taskId === "string" ? rawLink.taskId.trim() : "";
          if (!taskId) {
            return [];
          }

          return [
            {
              taskId,
              required: rawLink.required === true,
            },
          ];
        })
      : [];

    if (!id || !title || !startDate || !targetDate) {
      return [];
    }

    return [
      {
        id,
        title,
        description,
        startDate,
        targetDate,
        status: normalizeMilestoneStatus(raw.status),
        ownerId,
        ownerName,
        taskLinks,
        createdAt,
        updatedAt,
      },
    ];
  });
}

function normalizeSprints(value: unknown): ProjectSprint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const goal = typeof raw.goal === "string" ? raw.goal.trim() : "";
    const milestoneId = typeof raw.milestoneId === "string" ? raw.milestoneId.trim() : "";
    const startDate = normalizeDateString(raw.startDate);
    const endDate = normalizeDateString(raw.endDate);
    const ownerId = typeof raw.ownerId === "string" && raw.ownerId.trim() ? raw.ownerId.trim() : undefined;
    const ownerName = typeof raw.ownerName === "string" ? raw.ownerName.trim() || "Unassigned" : "Unassigned";
    const teamMemberIds = normalizeIdList(raw.teamMemberIds);
    const createdAt = normalizeDateString(raw.createdAt, new Date().toISOString()) || new Date().toISOString();
    const updatedAt = normalizeDateString(raw.updatedAt, createdAt) || createdAt;
    const completedAt =
      typeof raw.completedAt === "string" && normalizeDateString(raw.completedAt)
        ? normalizeDateString(raw.completedAt)
        : null;
    const taskAssignments = Array.isArray(raw.taskAssignments)
      ? raw.taskAssignments.flatMap((assignment) => {
          if (!assignment || typeof assignment !== "object") {
            return [];
          }

          const rawAssignment = assignment as Record<string, unknown>;
          const taskId = typeof rawAssignment.taskId === "string" ? rawAssignment.taskId.trim() : "";
          if (!taskId) {
            return [];
          }

          return [
            {
              taskId,
              stage: normalizeSprintStage(rawAssignment.stage),
            },
          ];
        })
      : [];

    if (!id || !name || !startDate || !endDate) {
      return [];
    }

    return [
      {
        id,
        name,
        goal,
        milestoneId,
        startDate,
        endDate,
        status: normalizeSprintStatus(raw.status),
        ownerId,
        ownerName,
        teamMemberIds,
        taskAssignments,
        createdAt,
        updatedAt,
        completedAt,
      },
    ];
  });
}

async function readLatestState(projectId: string | null, entityType: string, entityId?: string) {
  const log = await db.activityLog.findFirst({
    where: {
      ...(projectId === null ? { projectId: null } : { projectId }),
      entityType,
      ...(entityId ? { entityId } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { metadata: true },
  });

  return log?.metadata ?? null;
}

async function readProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const latest = await readLatestState(projectId, "project_task_state");
  const metadata =
    latest && typeof latest === "object"
      ? (latest as { tasks?: unknown[] })
      : null;

  return Array.isArray(metadata?.tasks)
    ? metadata.tasks.map(normalizeTask).filter((task): task is ProjectTask => Boolean(task))
    : [];
}

async function readWorkflowState(projectId: string) {
  const [sharedMilestoneState, legacyGlobalMilestoneState, localMilestoneState, sprintState, tasks] = await Promise.all([
    readLatestState(projectId, GLOBAL_MILESTONE_ENTITY_TYPE, getSharedMilestoneEntityId(projectId)),
    readLatestState(null, GLOBAL_MILESTONE_ENTITY_TYPE, GLOBAL_MILESTONE_ENTITY_ID),
    readLatestState(projectId, "project_milestone_state"),
    readLatestState(projectId, "project_sprint_state"),
    readProjectTasks(projectId),
  ]);

  const milestoneState =
    localMilestoneState ??
    sharedMilestoneState ??
    legacyGlobalMilestoneState;

  return {
    milestones: normalizeMilestones(
      milestoneState && typeof milestoneState === "object"
        ? (milestoneState as { milestones?: unknown[] }).milestones
        : []
    ),
    sprints: normalizeSprints(
      sprintState && typeof sprintState === "object"
        ? (sprintState as { sprints?: unknown[] }).sprints
        : []
    ),
    tasks,
  };
}

async function readWorkflowSelection(projectId: string) {
  const selectionState = await readLatestState(projectId, "project_workflow_selection");
  if (selectionState === null) {
    return null;
  }

  return normalizeWorkflowSelection(selectionState);
}

function getDefaultWorkflowSelection(
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[]
): ProjectWorkflowSelection {
  const activeSprint = sprints.find((sprint) => sprint.status === "ACTIVE");
  if (activeSprint) {
    return {
      milestoneId: activeSprint.milestoneId || null,
      sprintId: activeSprint.id,
    };
  }

  const activeMilestone =
    milestones.find(
      (milestone) =>
        milestone.status === "IN_PROGRESS" || milestone.status === "DELAYED"
    ) ?? milestones[0];

  return {
    milestoneId: activeMilestone?.id ?? null,
    sprintId: null,
  };
}

function resolveWorkflowSelection(
  selection: ProjectWorkflowSelection | null,
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[]
): ProjectWorkflowSelection {
  const defaultSelection = getDefaultWorkflowSelection(milestones, sprints);
  if (!selection) {
    return defaultSelection;
  }

  const hadExplicitSelection = Boolean(selection.milestoneId || selection.sprintId);
  let milestoneId = selection.milestoneId;
  let sprintId = selection.sprintId;

  const sprint = sprintId
    ? sprints.find((item) => item.id === sprintId) ?? null
    : null;

  if (!sprint) {
    sprintId = null;
  }

  if (sprint) {
    milestoneId = sprint.milestoneId || milestoneId;
  }

  if (milestoneId && !milestones.some((item) => item.id === milestoneId)) {
    milestoneId = null;
  }

  if (!milestoneId && !sprintId) {
    if (!hadExplicitSelection) {
      return {
        milestoneId: null,
        sprintId: null,
      };
    }

    return defaultSelection;
  }

  return {
    milestoneId,
    sprintId,
  };
}

async function readProjectWorkflowMeta(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      status: true,
      assignments: {
        select: {
          userId: true,
        },
      },
    },
  });

  return project;
}

async function writeStateLog(
  projectId: string | null,
  createdById: string,
  entityType: string,
  metadata: Prisma.InputJsonValue,
  entityId?: string
) {
  await db.activityLog.create({
    data: {
      action: "UPDATE",
      entityType,
      entityId: entityId ?? projectId ?? GLOBAL_MILESTONE_ENTITY_ID,
      projectId,
      createdById,
      metadata,
    },
  });
}

async function getWorkflowAccess(projectId: string) {
  const user = await requireModuleAccess("PROJECT");
  await requireProjectRecordAccess(projectId);
  return user;
}

function getTaskAssigneeId(task: ProjectTask) {
  return task.employeeAssigneeId?.trim() || task.assigneeId?.trim() || "";
}

function validateMilestones(
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[],
  tasks: ProjectTask[]
) {
  const milestoneIds = new Set<string>();
  const milestoneTaskOwners = new Map<string, string>();

  for (const milestone of milestones) {
    if (milestoneIds.has(milestone.id)) {
      return `Duplicate milestone detected: ${milestone.title}`;
    }
    milestoneIds.add(milestone.id);

    const startDate = new Date(milestone.startDate);
    const targetDate = new Date(milestone.targetDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(targetDate.getTime()) || startDate > targetDate) {
      return `Milestone "${milestone.title}" has an invalid date range`;
    }

    for (const link of milestone.taskLinks) {
      const task = tasks.find((item) => item.id === link.taskId);
      if (!task) {
        return `Milestone "${milestone.title}" contains an unknown task`;
      }

      const existingMilestoneId = milestoneTaskOwners.get(link.taskId);
      if (existingMilestoneId && existingMilestoneId !== milestone.id) {
        return `Task "${task.title}" cannot belong to multiple milestones`;
      }
      milestoneTaskOwners.set(link.taskId, milestone.id);
    }
  }

  for (const sprint of sprints) {
    if (!sprint.milestoneId) {
      continue;
    }

    const milestone = milestones.find((item) => item.id === sprint.milestoneId);
    if (!milestone) {
      return `Sprint "${sprint.name}" must belong to a valid milestone`;
    }

    if (!isSprintWithinMilestoneWindow(sprint, milestone)) {
      return `Sprint "${sprint.name}" must stay inside milestone "${milestone.title}" dates`;
    }
  }

  return null;
}

function validateSprints(
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[],
  tasks: ProjectTask[],
  projectTeamMemberIds: Set<string>
) {
  const sprintIds = new Set<string>();
  const assignedTaskIds = new Map<string, string>();
  const activeSprints = sprints.filter((sprint) => sprint.status === "ACTIVE");

  if (activeSprints.length > 1) {
    return "Only one sprint can be active at a time";
  }

  for (const sprint of sprints) {
    if (sprintIds.has(sprint.id)) {
      return `Duplicate sprint detected: ${sprint.name}`;
    }
    sprintIds.add(sprint.id);

    if (!sprint.milestoneId) {
      return `Sprint "${sprint.name}" must be linked to a milestone`;
    }

    const milestone = milestones.find((item) => item.id === sprint.milestoneId);
    if (!milestone) {
      return `Sprint "${sprint.name}" must belong to a valid milestone`;
    }

    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
      return `Sprint "${sprint.name}" has an invalid date range`;
    }

    if (!isSprintWithinMilestoneWindow(sprint, milestone)) {
      return `Sprint "${sprint.name}" must stay inside milestone "${milestone.title}" dates`;
    }

    if (sprint.ownerId && !projectTeamMemberIds.has(sprint.ownerId)) {
      return `Sprint "${sprint.name}" owner must be part of the project team`;
    }

    for (const memberId of sprint.teamMemberIds) {
      if (!projectTeamMemberIds.has(memberId)) {
        return `Sprint "${sprint.name}" contains an invalid team member`;
      }
    }

    for (const assignment of sprint.taskAssignments) {
      const task = tasks.find((item) => item.id === assignment.taskId);
      if (!task) {
        return `Sprint "${sprint.name}" contains an unknown task`;
      }

      const existingSprintId = assignedTaskIds.get(assignment.taskId);
      if (existingSprintId && existingSprintId !== sprint.id) {
        return `Task "${task.title}" cannot belong to multiple sprints`;
      }
      assignedTaskIds.set(assignment.taskId, sprint.id);

      if (!task.dueDate || !isTaskWithinSprintWindow(task, sprint)) {
        return `Task "${task.title}" must have a due date inside sprint "${sprint.name}"`;
      }

      const linkedMilestoneId = getTaskMilestoneId(task.id, milestones, sprints);
      if (linkedMilestoneId && linkedMilestoneId !== sprint.milestoneId) {
        return `Task "${task.title}" must stay inside the same milestone as sprint "${sprint.name}"`;
      }

      const taskAssigneeId = getTaskAssigneeId(task);
      if (taskAssigneeId && !projectTeamMemberIds.has(taskAssigneeId)) {
        return `Task "${task.title}" assignee must belong to the project team before it can be assigned to sprint "${sprint.name}"`;
      }

      if (
        taskAssigneeId &&
        sprint.teamMemberIds.length > 0 &&
        !sprint.teamMemberIds.includes(taskAssigneeId)
      ) {
        return `Task "${task.title}" assignee must be included in sprint "${sprint.name}" team`;
      }
    }
  }

  return null;
}

async function readCommonWorkflowState() {
  const commonMilestoneState = await readLatestState(
    null,
    GLOBAL_MILESTONE_ENTITY_TYPE,
    getCommonMilestoneEntityId()
  );

  return {
    milestones: normalizeMilestones(
      commonMilestoneState && typeof commonMilestoneState === "object"
        ? (commonMilestoneState as { milestones?: unknown[] }).milestones
        : []
    ),
  };
}

async function syncProjectCompletionState(
  projectId: string,
  milestones: ProjectMilestone[],
  sprints: ProjectSprint[],
  tasks: ProjectTask[]
) {
  const project = await readProjectWorkflowMeta(projectId);
  if (!project) {
    return;
  }

  if (!isProjectWorkflowComplete(milestones, sprints, tasks)) {
    return;
  }

  if (project.status === "COMPLETED") {
    return;
  }

  await updateProjectStatus(projectId, "COMPLETED");
}

export async function getProjectWorkflowState(projectId: string): Promise<ProjectWorkflowPayload> {
  try {
    await getWorkflowAccess(projectId);
    const { milestones, sprints, tasks } = await readWorkflowState(projectId);

    return {
      error: undefined,
      tasks,
      milestones,
      sprints,
    };
  } catch {
    return {
      error: "Unable to load project workflow state",
      tasks: [],
      milestones: [],
      sprints: [],
    };
  }
}

export async function getProjectWorkflowSelection(
  projectId: string
): Promise<ProjectWorkflowSelectionPayload> {
  try {
    await getWorkflowAccess(projectId);

    const [{ milestones, sprints }, selection] = await Promise.all([
      readWorkflowState(projectId),
      readWorkflowSelection(projectId),
    ]);

    return {
      error: undefined,
      ...resolveWorkflowSelection(selection, milestones, sprints),
    };
  } catch {
    return {
      error: "Unable to load project workflow selection",
      milestoneId: null,
      sprintId: null,
    };
  }
}

export async function saveProjectWorkflowSelection(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");

  if (!projectId) {
    return { error: "Project is required" };
  }

  await requireActionPermission("UPDATE", "PROJECT");
  const user = await getWorkflowAccess(projectId);

  const rawMilestoneId = normalizeSelectionId(formData.get("milestoneId"));
  const rawSprintId = normalizeSelectionId(formData.get("sprintId"));
  const { milestones, sprints } = await readWorkflowState(projectId);

  let milestone = rawMilestoneId
    ? milestones.find((item) => item.id === rawMilestoneId) ?? null
    : null;
  const sprint = rawSprintId
    ? sprints.find((item) => item.id === rawSprintId) ?? null
    : null;

  if (rawMilestoneId && !milestone) {
    return { error: "Selected milestone no longer exists" };
  }

  if (rawSprintId && !sprint) {
    return { error: "Selected sprint no longer exists" };
  }

  if (sprint) {
    milestone = milestones.find((item) => item.id === sprint?.milestoneId) ?? null;
    if (!milestone) {
      return { error: `Sprint "${sprint.name}" is not linked to a valid milestone` };
    }
  }

  const milestoneId = milestone?.id ?? null;
  const sprintId = sprint?.id ?? null;

  await writeStateLog(projectId, user.id, "project_workflow_selection", toJsonValue({
    milestoneId,
    sprintId,
    milestoneName: milestone?.title ?? null,
    sprintName: sprint?.name ?? null,
  }));

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    error: undefined,
    milestoneId,
    sprintId,
  };
}

export async function saveProjectMilestones(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const milestonesRaw = String(formData.get("milestones") || "");

  if (!projectId) {
    return { error: "Project is required" };
  }

  await requireActionPermission("UPDATE", "PROJECT");
  const user = await getWorkflowAccess(projectId);

  let milestones: ProjectMilestone[] = [];
  try {
    const parsed = milestonesRaw ? JSON.parse(milestonesRaw) : [];
    milestones = normalizeMilestones(parsed);
  } catch {
    return { error: "Invalid milestone data" };
  }

  const { sprints, tasks } = await readWorkflowState(projectId);
  const milestoneError = validateMilestones(milestones, sprints, tasks);
  if (milestoneError) {
    return { error: milestoneError };
  }

  const projectMeta = await readProjectWorkflowMeta(projectId);
  if (!projectMeta) {
    return { error: "Project not found" };
  }

  const sprintError = validateSprints(
    milestones,
    sprints,
    tasks,
    new Set(projectMeta.assignments.map((assignment) => assignment.userId))
  );
  if (sprintError) {
    return { error: sprintError };
  }

  await writeStateLog(
    projectId,
    user.id,
    GLOBAL_MILESTONE_ENTITY_TYPE,
    toJsonValue({ milestones }),
    getSharedMilestoneEntityId(projectId)
  );

  await syncProjectCompletionState(projectId, milestones, sprints, tasks);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: undefined, milestones };
}

export async function getCommonMilestonesState(): Promise<Pick<ProjectWorkflowPayload, "milestones" | "error">> {
  try {
    await requireModuleAccess("PROJECT");
    const { milestones } = await readCommonWorkflowState();
    return {
      error: undefined,
      milestones,
    };
  } catch {
    return {
      error: "Unable to load common milestones",
      milestones: [],
    };
  }
}

export async function saveCommonMilestones(formData: FormData) {
  const milestonesRaw = String(formData.get("milestones") || "");
  let user;

  try {
    user = await requireModuleAccess("PROJECT");
  } catch {
    return { error: "You do not have permission to manage common milestones" };
  }

  let milestones: ProjectMilestone[] = [];
  try {
    const parsed = milestonesRaw ? JSON.parse(milestonesRaw) : [];
    milestones = normalizeMilestones(parsed);
  } catch {
    return { error: "Invalid milestone data" };
  }

  const milestoneError = validateMilestones(milestones, [], []);
  if (milestoneError) {
    return { error: milestoneError };
  }

  await writeStateLog(
    null,
    user.id,
    GLOBAL_MILESTONE_ENTITY_TYPE,
    toJsonValue({ milestones }),
    getCommonMilestoneEntityId()
  );

  revalidatePath("/projects");
  return { success: true, error: undefined, milestones };
}

export async function saveProjectSprints(formData: FormData) {
  const projectId = String(formData.get("projectId") || "");
  const sprintsRaw = String(formData.get("sprints") || "");

  if (!projectId) {
    return { error: "Project is required" };
  }

  await requireActionPermission("UPDATE", "PROJECT");
  const user = await getWorkflowAccess(projectId);

  let sprints: ProjectSprint[] = [];
  try {
    const parsed = sprintsRaw ? JSON.parse(sprintsRaw) : [];
    sprints = normalizeSprints(parsed);
  } catch {
    return { error: "Invalid sprint data" };
  }

  const { milestones, tasks } = await readWorkflowState(projectId);
  const milestoneError = validateMilestones(milestones, sprints, tasks);
  if (milestoneError) {
    return { error: milestoneError };
  }

  const projectMeta = await readProjectWorkflowMeta(projectId);
  if (!projectMeta) {
    return { error: "Project not found" };
  }

  const sprintError = validateSprints(
    milestones,
    sprints,
    tasks,
    new Set(projectMeta.assignments.map((assignment) => assignment.userId))
  );
  if (sprintError) {
    return { error: sprintError };
  }

  await writeStateLog(projectId, user.id, "project_sprint_state", toJsonValue({ sprints }));

  await syncProjectCompletionState(projectId, milestones, sprints, tasks);
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: undefined, sprints };
}
