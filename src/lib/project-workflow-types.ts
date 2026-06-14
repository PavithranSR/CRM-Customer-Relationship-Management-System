export type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "REACHED" | "DELAYED";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED" | "CANCELLED";

export type SprintStageKey = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";

export interface MilestoneTaskLink {
  taskId: string;
  required: boolean;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  description: string;
  startDate: string;
  targetDate: string;
  status: MilestoneStatus;
  ownerId?: string;
  ownerName?: string;
  taskLinks: MilestoneTaskLink[];
  createdAt: string;
  updatedAt: string;
}

export interface SprintTaskAssignment {
  taskId: string;
  stage: SprintStageKey;
}

export interface ProjectSprint {
  id: string;
  name: string;
  goal: string;
  milestoneId: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  ownerId?: string;
  ownerName: string;
  teamMemberIds: string[];
  taskAssignments: SprintTaskAssignment[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface ProjectWorkflowState {
  milestones: ProjectMilestone[];
  sprints: ProjectSprint[];
}
