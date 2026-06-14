import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Calendar, Clock, Pencil, Users } from "lucide-react";
import { AssignmentManager } from "@/components/projects/assignment-manager";
import { EmployeeTaskList } from "@/components/projects/employee-task-list";
import { IndividualProjectUpdates } from "@/components/projects/individual-project-updates";
import { ProjectActivityHistory } from "@/components/projects/project-activity-history";
import { ProjectComments } from "@/components/projects/project-comments";
import { ProjectActions } from "@/components/projects/project-actions";
import { TaskProgressOverview } from "@/components/projects/task-progress-overview";
import { TlProjectKanban } from "@/components/projects/tl-project-kanban";
import { TlTaskSplitter } from "@/components/projects/tl-task-splitter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  getProjectAssignableMembers,
  getProjectBasicAssignees,
  type ProjectDetailLog,
  type ProjectPageProject,
  type ProjectPageStats,
} from "./project-page-helpers";
import { ProjectPageHeader } from "./project-page-header";

interface ProjectOverviewViewProps {
  canAssignMembers: boolean;
  canCreateByPermission: boolean;
  canDeleteByPermission: boolean;
  canEditByPermission: boolean;
  canUpdateByPermission: boolean;
  canUseProjectActions: boolean;
  currentUserId: string;
  currentUserRole: ProjectPageProject["assignments"][number]["user"]["role"] | "ADMIN" | "BA";
  hasTaskManagementPermission: boolean;
  project: ProjectPageProject;
  projectLogs: ProjectDetailLog[];
  responsibleLeadName: string;
  stats: ProjectPageStats;
}

interface ProjectStatCardProps {
  description: string;
  icon?: ReactNode;
  progress?: number;
  title: string;
  value: string;
}

function ProjectStatCard({
  description,
  icon,
  progress,
  title,
  value,
}: ProjectStatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {typeof progress === "number" ? <Progress value={progress} className="mt-2" /> : null}
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function ProjectDataSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
      <summary className="cursor-pointer list-none px-4 py-3 font-medium">
        {title}
      </summary>
      <div className="px-2 pb-2">{children}</div>
    </details>
  );
}

export function ProjectOverviewView({
  canAssignMembers,
  canCreateByPermission,
  canDeleteByPermission,
  canEditByPermission,
  canUpdateByPermission,
  canUseProjectActions,
  currentUserId,
  currentUserRole,
  hasTaskManagementPermission,
  project,
  projectLogs,
  responsibleLeadName,
  stats,
}: ProjectOverviewViewProps) {
  return (
    <div className="space-y-6">
      <ProjectPageHeader
        project={project}
        showBadges
        actions={
          <>
            {canUseProjectActions ? <ProjectActions project={project} /> : null}
            {canEditByPermission ? (
              <Button asChild>
                <Link href={`/projects/${project.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {project.status === "ON_HOLD" && project.holdReason ? (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Project on Hold</p>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">{project.holdReason}</p>
              {project.holdStartDate ? (
                <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  On hold since {format(new Date(project.holdStartDate), "MMM d, yyyy")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <ProjectStatCard
          title="Progress"
          value={`${project.progress}%`}
          description="Current completion status"
          progress={project.progress}
        />
        <ProjectStatCard
          title="Total Hours"
          value={stats.totalHours.toFixed(1)}
          description={project.estimatedHours ? `of ${project.estimatedHours}h estimated` : "hours logged"}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
        <ProjectStatCard
          title="Team Size"
          value={String(project.assignments.length)}
          description="members assigned"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <ProjectStatCard
          title="Deadline"
          value={project.deadline ? format(new Date(project.deadline), "MMM d") : "-"}
          description={project.deadline ? format(new Date(project.deadline), "yyyy") : "No deadline set"}
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description ? (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1">{project.description}</p>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium">{project.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Client</p>
                <p className="font-medium">{project.client?.name || "Not linked"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Project Lead</p>
                <p className="font-medium">{responsibleLeadName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hold Days</p>
                <p className="font-medium">{project.totalHoldDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Assigned employees</CardDescription>
          </CardHeader>
          <CardContent>
            {canAssignMembers ? (
              <AssignmentManager
                projectId={project.id}
                projectName={project.name}
                projectStatus={project.status}
                projectType={project.type}
                assignments={project.assignments}
                canAssign={canAssignMembers}
              />
            ) : (
              <div className="space-y-3">
                {project.assignments.length === 0 ? (
                  <p className="text-muted-foreground">No team members assigned</p>
                ) : (
                  project.assignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-medium">
                          {assignment.user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{assignment.user.name}</p>
                          <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.user.role}</Badge>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {canCreateByPermission && project.type === "TEAM" ? (
          <TlTaskSplitter projectId={project.id} assignments={project.assignments} />
        ) : null}

        {(currentUserRole === "ADMIN" || currentUserRole === "BA") ? (
          <ProjectDataSection
            title={
              project.type === "TEAM"
                ? "Task Progress Data (Click to show data)"
                : "Individual Daily Work Updates (Click to show data)"
            }
          >
            {project.type === "TEAM" ? (
              <TaskProgressOverview
                projectId={project.id}
                assignees={getProjectBasicAssignees(project)}
              />
            ) : (
              <IndividualProjectUpdates
                projectId={project.id}
                canSubmit={false}
                title="Employee Daily Work Updates"
              />
            )}
          </ProjectDataSection>
        ) : null}

        {(currentUserRole === "EMPLOYEE" || currentUserRole === "TEAMLEADER") ? (
          project.type === "TEAM" ? (
            hasTaskManagementPermission ? (
              <TlProjectKanban
                projectId={project.id}
                assignments={project.assignments}
                canCreate={canCreateByPermission}
                canUpdate={canUpdateByPermission}
                canEdit={canEditByPermission}
                canDelete={canDeleteByPermission}
              />
            ) : currentUserRole === "EMPLOYEE" ? (
              <EmployeeTaskList
                projectId={project.id}
                currentUserId={currentUserId}
                assignees={getProjectAssignableMembers(project)}
              />
            ) : null
          ) : (
            <IndividualProjectUpdates
              projectId={project.id}
              canSubmit
              title="My Daily Work Comments"
            />
          )
        ) : null}

        <ProjectDataSection title="Project Comments (Click to show data)">
          <ProjectComments projectId={project.id} />
        </ProjectDataSection>

        <ProjectDataSection title="Project Activity History (Click to show data)">
          <ProjectActivityHistory logs={projectLogs} />
        </ProjectDataSection>

        <details name="project-data-sections" className="md:col-span-2 rounded-lg border bg-background">
          <summary className="cursor-pointer list-none px-4 py-3 font-medium">
            Recent Time Entries (Click to show data)
          </summary>
          <div className="p-4">
            {project.timeEntries.length === 0 ? (
              <p className="text-muted-foreground">No time entries yet</p>
            ) : (
              <div className="space-y-3">
                {project.timeEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between border-b py-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium">
                        {entry.user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{entry.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.date), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.hours}h</p>
                      <p className="max-w-xs truncate text-sm text-muted-foreground">
                        {entry.description || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
