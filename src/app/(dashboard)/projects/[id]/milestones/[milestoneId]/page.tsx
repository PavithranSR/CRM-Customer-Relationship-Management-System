import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject, getProjects } from "@/actions/project.actions";
import { getProjectWorkflowSelection, getProjectWorkflowState } from "@/actions/project-workflow.actions";
import { buildProjectWhereForViewer } from "@/lib/employee-permissions";
import { ProjectMilestoneTaskLinkPage } from "@/components/projects/project-milestone-task-link-page";

interface ProjectMilestoneTaskPageProps {
  params: Promise<{ id: string; milestoneId: string }>;
}

export default async function ProjectMilestoneTaskPage({ params }: ProjectMilestoneTaskPageProps) {
  const { id, milestoneId } = await params;
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

  const workflowState = await getProjectWorkflowState(id);
  if (workflowState.error) {
    notFound();
  }

  const milestone = workflowState.milestones.find((item) => item.id === milestoneId) ?? null;
  if (!milestone) {
    notFound();
  }

  const accessibleProjects = await getProjects();
  const relatedProjects = (
    await Promise.all(
      accessibleProjects.map(async (item) => {
        const selection = await getProjectWorkflowSelection(item.id);
        if (selection.error || selection.milestoneId !== milestone.id) {
          return null;
        }

        return item;
      })
    )
  ).filter(
    (
      item
    ): item is (typeof accessibleProjects)[number] =>
      Boolean(item)
  );

  if (session.user.role !== "ADMIN") {
    redirect(`/projects/${id}`);
  }

  return (
    <ProjectMilestoneTaskLinkPage
      projectId={project.id}
      projectName={project.name}
      projectCode={project.code}
      milestone={milestone}
      relatedProjects={relatedProjects}
      sprints={workflowState.sprints}
      tasks={workflowState.tasks}
    />
  );
}
