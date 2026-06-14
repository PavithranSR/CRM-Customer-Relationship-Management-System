import type { getProject, getProjectStats } from "@/actions/project.actions";
import type { ActivityAction, Priority, ProjectStatus, Role } from "@prisma/client";

export type ProjectPageProject = NonNullable<Awaited<ReturnType<typeof getProject>>>;
export type ProjectPageStats = Awaited<ReturnType<typeof getProjectStats>>;
export type ProjectPageAssignment = ProjectPageProject["assignments"][number];
export type ProjectPageUser = ProjectPageAssignment["user"];
export type ProjectPageLead = NonNullable<ProjectPageProject["manager"]> | ProjectPageUser;

interface ProjectActivityActor {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ProjectDetailLog {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  projectId: string | null;
  userId: string | null;
  metadata: unknown;
  createdAt: Date;
  createdById: string;
  createdBy?: ProjectActivityActor | null;
  user?: ProjectActivityActor | null;
}

export type ProjectDetailTab = "tasks" | "reports";

export function resolveProjectDetailTab(view?: string): ProjectDetailTab {
  if (view === "reports") {
    return "reports";
  }
  return "tasks";
}

export function getProjectActivityLabel(log: {
  entityType: string;
  action: string;
  metadata: unknown;
}) {
  const metadata = (log.metadata && typeof log.metadata === "object"
    ? log.metadata
    : null) as Record<string, unknown> | null;

  if (log.entityType === "project_comment") {
    return "Project comment added";
  }
  if (log.entityType === "task_comment") {
    return "Task comment added";
  }
  if (log.entityType === "project_task" && log.action === "CREATE") {
    return `Task created: ${String(metadata?.title ?? "Untitled")}`;
  }
  if (log.entityType === "project_task" && log.action === "UPDATE") {
    return "Task updated";
  }
  if (log.entityType === "project_task_state") {
    return "Task board state updated";
  }
  if (log.entityType === "project_milestone_state") {
    return "Milestone board updated";
  }
  if (log.entityType === "project_sprint_state") {
    return "Sprint board updated";
  }
  if (log.entityType === "project_workflow_selection") {
    const milestoneName =
      typeof metadata?.milestoneName === "string" ? metadata.milestoneName.trim() : "";
    const sprintName =
      typeof metadata?.sprintName === "string" ? metadata.sprintName.trim() : "";

    if (milestoneName && sprintName) {
      return `Selected ${milestoneName} / ${sprintName}`;
    }
    if (milestoneName) {
      return `Selected milestone: ${milestoneName}`;
    }
    if (sprintName) {
      return `Selected sprint: ${sprintName}`;
    }

    return "Workflow selection cleared";
  }

  return `${log.entityType.replaceAll("_", " ")} ${log.action.toLowerCase()}`;
}

export const projectStatusColors: Record<ProjectStatus, string> = {
  PLANNING: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

export const projectPriorityColors: Record<Priority, string> = {
  LOW: "bg-gray-400",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

export function getAssignedTeamLeader(project: ProjectPageProject) {
  return project.assignments.find((assignment) => assignment.user.role === "TEAMLEADER")?.user ?? null;
}

export function getProjectTaskTeamId(project: ProjectPageProject) {
  return project.manager?.teamId ?? getAssignedTeamLeader(project)?.teamId ?? null;
}

export function getProjectLead(project: ProjectPageProject): ProjectPageLead | null {
  return project.manager ?? getAssignedTeamLeader(project);
}

export function getProjectLeadName(project: ProjectPageProject) {
  return getProjectLead(project)?.name || "Not assigned";
}

export function getProjectTaskCount(projectLogs: ProjectDetailLog[]) {
  const latestTaskStateLog = projectLogs.find((log) => log.entityType === "project_task_state");
  return latestTaskStateLog?.metadata &&
    typeof latestTaskStateLog.metadata === "object" &&
    Array.isArray((latestTaskStateLog.metadata as { tasks?: unknown[] }).tasks)
    ? (latestTaskStateLog.metadata as { tasks: unknown[] }).tasks.length
    : 0;
}

export function getProjectCategory(project: ProjectPageProject) {
  return (
    project.serviceName?.trim() ||
    project.client?.serviceName?.trim() ||
    project.tags
      ?.split(",")
      .map((item) => item.trim())
      .find(Boolean) ||
    (project.type === "TEAM" ? "Team Project" : "Individual Project")
  );
}

export function getProjectBasicAssignees(project: ProjectPageProject) {
  return project.assignments.map((assignment) => ({
    id: assignment.user.id,
    name: assignment.user.name,
    email: assignment.user.email,
    role: assignment.user.role,
  }));
}

export function getProjectAssignableMembers(project: ProjectPageProject) {
  return project.assignments.map((assignment) => ({
    id: assignment.user.id,
    name: assignment.user.name,
    role: assignment.user.role,
  }));
}

export function getProjectAdminAssignments(project: ProjectPageProject) {
  return project.assignments.map((assignment) => ({
    id: assignment.user.id,
    name: assignment.user.name,
    email: assignment.user.email,
    role: assignment.user.role,
    department: assignment.user.department,
    position: assignment.user.position,
    phone: assignment.user.phone,
    hireDate: assignment.user.hireDate,
    isActive: assignment.user.isActive,
  }));
}

export function getProjectEmployeeMembers(project: ProjectPageProject) {
  return project.assignments
    .filter((assignment) => assignment.user.role === "EMPLOYEE")
    .map((assignment) => ({
      id: assignment.user.id,
      name: assignment.user.name,
      email: assignment.user.email,
    }));
}
