import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth, canAccessAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject } from "@/actions/project.actions";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { TaskEditForm } from "@/components/projects/admin-project-task-monitor-parts/task-edit-form";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { normalizeTask, type ProjectTask } from "@/lib/project-task-utils";

interface ProjectTaskEditPageProps {
  params: Promise<{ id: string; taskId: string }>;
}

export default async function ProjectTaskEditPage({ params }: ProjectTaskEditPageProps) {
  const { id, taskId } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

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
  const canEditTask =
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

  if (!canEditTask) {
    redirect(`/projects/${id}/tasks/${taskId}`);
  }

  const employeeAssignments = project.assignments
    .map((assignment) => assignment.user)
    .filter((user) => user.role === "EMPLOYEE" || user.role === "TEAMLEADER")
    .map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
      department: user.department,
      position: user.position,
      phone: user.phone,
      hireDate: user.hireDate,
      isActive: user.isActive,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${id}/tasks/${taskId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Task</h1>
          <p className="text-muted-foreground">
            {project.name} {project.code ? `- ${project.code}` : ""}
          </p>
        </div>
      </div>

      <TaskEditForm
        backHref={`/projects/${id}/tasks/${taskId}`}
        employeeAssignments={employeeAssignments}
        projectId={id}
        stages={normalizedStages}
        task={task}
      />
    </div>
  );
}
