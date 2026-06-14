import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject } from "@/actions/project.actions";
import { getProjectTasks } from "@/actions/project-task.actions";
import { getEmployees } from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminProjectTaskMonitor } from "@/components/projects/admin-project-task-monitor";
import { getProjectTaskTeamId } from "@/components/projects/project-page/project-page-helpers";
import { TlTaskDetail } from "@/components/projects/tl-task-detail";
import { buildProjectWhereForViewer, normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { normalizeTask, type ProjectTask } from "@/lib/project-task-utils";
import { canAccessAction } from "@/lib/auth";

interface ProjectTaskDetailsPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function ProjectTaskDetailsPage({ params }: ProjectTaskDetailsPageProps) {
  const { id, taskId } = await params;
  const session = await auth();
  if (!session?.user) return null;

  const project = await getProject(id);
  if (!project) {
    notFound();
  }

  const projectWhere = buildProjectWhereForViewer({
    userId: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });
  const canViewProject = await db.project.count({
    where: {
      id: project.id,
      ...projectWhere,
    },
  });
  if (canViewProject === 0) {
    notFound();
  }

  const taskState = await getProjectTasks(id);
  if (taskState.error) {
    notFound();
  }

  const normalizedTasks = taskState.data
    .map(normalizeTask)
    .filter((item): item is ProjectTask => Boolean(item));
  const task = normalizedTasks.find((item) => item.id === taskId) ?? null;
  if (!task) {
    notFound();
  }
  const normalizedStages = (taskState.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const canEditTaskDeadline =
    canAccessAction({
      role: session.user.role,
      permissions: session.user.permissions,
      action: "UPDATE",
      module: "PROJECT",
    }) ||
    canAccessAction({
      role: session.user.role,
      permissions: session.user.permissions,
      action: "EDIT",
      module: "PROJECT",
    });
  const canAssignEmployee = session.user.role === "ADMIN" || session.user.role === "TEAMLEADER";

  if (session.user.role === "ADMIN") {
    const adminTaskEmployees = (await getEmployees())
      .filter((employee) => {
        return (
          employee.isActive &&
          employee.role === "EMPLOYEE" &&
          normalizeEmployeePermissions(employee.permissions).moduleAccess.includes("PROJECT")
        );
      })
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        teamId: employee.teamId,
        department: employee.department,
        position: employee.position,
        phone: employee.phone,
        hireDate: employee.hireDate,
        isActive: employee.isActive,
      }));

    return (
      <div className="space-y-6">
        <AdminProjectTaskMonitor
          projectId={id}
          projectTeamId={getProjectTaskTeamId(project)}
          projectType={project.type}
          projectName={project.name}
          projectCategory={
            project.serviceName?.trim() ||
            project.client?.serviceName?.trim() ||
            project.tags
              ?.split(",")
              .map((item) => item.trim())
              .find(Boolean) ||
            (project.type === "TEAM" ? "Team Project" : "Individual Project")
          }
          projectManagerName={project.manager?.name ?? null}
          projectTags={project.tags}
          assignments={project.assignments.map((assignment) => ({
            id: assignment.user.id,
            name: assignment.user.name,
            email: assignment.user.email,
            role: assignment.user.role,
            teamId: assignment.user.teamId,
            department: assignment.user.department,
            position: assignment.user.position,
            phone: assignment.user.phone,
            hireDate: assignment.user.hireDate,
            isActive: assignment.user.isActive,
          }))}
          employees={adminTaskEmployees}
          initialTasks={normalizedTasks}
          initialStages={normalizedStages}
          initialSelectedTaskId={taskId}
          standaloneTaskPage
        />
      </div>
    );
  }

  if (session.user.role !== "TEAMLEADER") {
    redirect(`/projects/${id}?view=kanban`);
  }

  if (task.assignedTlId !== session.user.id && task.assigneeId !== session.user.id) {
    notFound();
  }

  const stageName =
    taskState.stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do";

  const projectEmployees = project.assignments
    .map((assignment) => assignment.user)
    .filter((user) => user.role === "EMPLOYEE")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${id}?view=kanban`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground">{project.code}</p>
        </div>
        <Badge variant="outline">Task Details</Badge>
      </div>

      <TlTaskDetail
        projectId={id}
        task={task}
        stageName={stageName}
        employees={projectEmployees}
        canEditDeadline={canEditTaskDeadline}
        canAssignEmployee={canAssignEmployee}
      />
    </div>
  );
}

