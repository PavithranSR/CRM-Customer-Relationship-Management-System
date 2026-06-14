import { AdminProjectReports } from "@/components/projects/admin-project-reports";
import { AdminProjectTaskMonitor } from "@/components/projects/admin-project-task-monitor";
import { BaProjectTasks } from "@/components/projects/ba-project-tasks";
import { EmployeeTaskList } from "@/components/projects/employee-task-list";
import { TlProjectKanban } from "@/components/projects/tl-project-kanban";
import { TlTeamMembers } from "@/components/projects/tl-team-members";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getProjectAdminAssignments,
  getProjectAssignableMembers,
  getProjectBasicAssignees,
  getProjectCategory,
  getProjectEmployeeMembers,
  getProjectTaskTeamId,
  type ProjectDetailTab,
  type ProjectPageProject,
  type ProjectPageStats,
} from "./project-page-helpers";
import { ProjectPageHeader, ProjectViewToggle } from "./project-page-header";

interface ProjectAdminViewProps {
  adminTaskEmployees: Array<{
    id: string;
    name: string;
    email: string;
    role: ProjectPageProject["assignments"][number]["user"]["role"];
    teamId?: string | null;
    department: string | null;
    position: string | null;
    phone: string | null;
    hireDate: Date | null;
    isActive: boolean;
  }>;
  assignedTeamLeaderName: string | null;
  project: ProjectPageProject;
  projectTeamId: string | null;
  requestedDetailTab: ProjectDetailTab;
  stats: ProjectPageStats;
}

interface ProjectBaViewProps {
  canCreateByPermission: boolean;
  canDeleteByPermission: boolean;
  canEditByPermission: boolean;
  canUpdateByPermission: boolean;
  hasTaskManagementPermission: boolean;
  project: ProjectPageProject;
}

interface ProjectRoleKanbanViewProps {
  canCreateByPermission: boolean;
  canDeleteByPermission: boolean;
  canEditByPermission: boolean;
  canUpdateByPermission: boolean;
  currentUserId: string;
  hasTaskManagementPermission: boolean;
  project: ProjectPageProject;
  showTeamLink: boolean;
}

export function ProjectAdminView({
  adminTaskEmployees,
  assignedTeamLeaderName,
  project,
  projectTeamId,
  requestedDetailTab,
  stats,
}: ProjectAdminViewProps) {
  if (requestedDetailTab === "reports") {
    return (
      <div className="space-y-6">
        <AdminProjectReports
          projectId={project.id}
          teamMembers={project.assignments.map((assignment) => ({
            id: assignment.user.id,
            name: assignment.user.name,
            role: assignment.user.role,
          }))}
          hoursByUser={stats.hoursByUser.map((entry) => ({
            userId: entry.userId,
            _sum: { hours: entry._sum.hours ?? 0 },
          }))}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminProjectTaskMonitor
        projectId={project.id}
        projectTeamId={projectTeamId ?? getProjectTaskTeamId(project)}
        projectType={project.type}
        projectName={project.name}
        projectCategory={getProjectCategory(project)}
        projectManagerName={project.manager?.name ?? assignedTeamLeaderName}
        projectTags={project.tags}
        assignments={getProjectAdminAssignments(project)}
        employees={adminTaskEmployees}
        taskDetailMode="page"
      />
    </div>
  );
}

export function ProjectBaView({
  canCreateByPermission,
  canDeleteByPermission,
  canEditByPermission,
  canUpdateByPermission,
  hasTaskManagementPermission,
  project,
}: ProjectBaViewProps) {
  return (
    <div className="space-y-6">
      <ProjectPageHeader project={project} showBadges />

      <div className="mt-2">
        {project.type === "TEAM" && hasTaskManagementPermission ? (
          <TlProjectKanban
            projectId={project.id}
            assignments={project.assignments}
            canCreate={canCreateByPermission}
            canUpdate={canUpdateByPermission}
            canEdit={canEditByPermission}
            canDelete={canDeleteByPermission}
          />
        ) : (
          <BaProjectTasks
            projectId={project.id}
            projectName={project.name}
            assignments={getProjectBasicAssignees(project)}
          />
        )}
      </div>
    </div>
  );
}

export function ProjectRoleKanbanView({
  canCreateByPermission,
  canDeleteByPermission,
  canEditByPermission,
  canUpdateByPermission,
  currentUserId,
  hasTaskManagementPermission,
  project,
  showTeamLink,
}: ProjectRoleKanbanViewProps) {
  return (
    <div className="space-y-6">
      <ProjectPageHeader project={project} />
      <ProjectViewToggle
        activeView="kanban"
        projectId={project.id}
        showTeamLink={showTeamLink}
      />

      {project.type === "TEAM" ? (
        hasTaskManagementPermission ? (
          <TlProjectKanban
            projectId={project.id}
            assignments={project.assignments}
            canCreate={canCreateByPermission}
            canUpdate={canUpdateByPermission}
            canEdit={canEditByPermission}
            canDelete={canDeleteByPermission}
          />
        ) : (
          <EmployeeTaskList
            projectId={project.id}
            currentUserId={currentUserId}
            assignees={getProjectAssignableMembers(project)}
          />
        )
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Task Process Kanban</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Kanban process is available only for TEAM projects.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ProjectRoleTeamViewProps {
  project: ProjectPageProject;
}

export function ProjectRoleTeamView({ project }: ProjectRoleTeamViewProps) {
  return (
    <div className="space-y-6">
      <ProjectPageHeader project={project} />
      <ProjectViewToggle activeView="team" projectId={project.id} showTeamLink />

      <TlTeamMembers
        projectId={project.id}
        employees={getProjectEmployeeMembers(project)}
      />
    </div>
  );
}
