import { notFound } from "next/navigation";
import { getProject } from "@/actions/project.actions";
import { getProjectTasks } from "@/actions/project-task.actions";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { getTaskStatus, normalizeTask, type ProjectTask } from "@/lib/project-task-utils";
import { ProjectTeamMembersBrowser } from "@/components/projects/project-team-members-browser";

interface ProjectTeamMembersPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pickerKey?: string; returnHref?: string }>;
}

function normalizeReturnHref(value: string | undefined, projectId: string) {
  if (typeof value === "string" && value.startsWith("/")) {
    return value;
  }

  return `/projects/${projectId}?view=kanban`;
}

export default async function ProjectTeamMembersPage({ params, searchParams }: ProjectTeamMembersPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = await auth();

  if (!session?.user) {
    return null;
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

  const tasks = (taskState.data ?? [])
    .map(normalizeTask)
    .filter((task): task is ProjectTask => Boolean(task));

  const members = project.assignments
    .map((assignment) => assignment.user)
    .filter((user) => user.role === "EMPLOYEE" || user.role === "TEAMLEADER")
    .map((user) => {
      const memberTasks = tasks.filter(
        (task) => task.employeeAssigneeId === user.id || (!task.employeeAssigneeId && task.assigneeId === user.id)
      );
      const completedTasks = memberTasks.filter((task) => getTaskStatus(task) === "DONE").length;
      const activeTasks = memberTasks.length - completedTasks;

      return {
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
        activeTasks,
        completedTasks,
        currentStatus: activeTasks > 0 ? "Busy" : completedTasks > 0 ? "Completed" : "Idle",
      };
    })
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name);
      if (byName !== 0) return byName;
      return left.email.localeCompare(right.email);
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <ProjectTeamMembersBrowser
        members={members}
        pickerKey={resolvedSearchParams.pickerKey ?? null}
        projectId={project.id}
        projectName={project.name}
        returnHref={normalizeReturnHref(resolvedSearchParams.returnHref, project.id)}
      />
    </div>
  );
}
