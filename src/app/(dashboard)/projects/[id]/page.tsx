import { notFound, redirect } from "next/navigation";
import { getEmployees } from "@/actions/employee.actions";
import { getProject, getProjectStats } from "@/actions/project.actions";
import { ProjectDetailView } from "@/components/projects/project-page/project-detail-view";
import { ProjectOverviewView } from "@/components/projects/project-page/project-overview-view";
import {
  getAssignedTeamLeader,
  getProjectLeadName,
  getProjectTaskCount,
  getProjectTaskTeamId,
  resolveProjectDetailTab,
  type ProjectDetailLog,
} from "@/components/projects/project-page/project-page-helpers";
import {
  ProjectAdminView,
  ProjectBaView,
  ProjectRoleKanbanView,
  ProjectRoleTeamView,
} from "@/components/projects/project-page/project-role-views";
import { auth, canAccessAction } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildProjectWhereForViewer, normalizeEmployeePermissions } from "@/lib/employee-permissions";

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}

export default async function ProjectPage({ params, searchParams }: ProjectPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedView = resolvedSearchParams.view;
  const requestedDetailTab = resolveProjectDetailTab(requestedView);
  const isDetailsView = resolvedSearchParams.view === "details";
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  if (requestedView === "milestones" || requestedView === "sprints") {
    if (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") {
      redirect(`/projects/${id}?view=kanban`);
    }

    redirect(`/projects/${id}?view=details`);
  }

  if (
    (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") &&
    (resolvedSearchParams.view === "details" || !resolvedSearchParams.view)
  ) {
    redirect(`/projects/${id}?view=kanban`);
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
  const matchingProjectCount = await db.project.count({
    where: {
      id: project.id,
      ...projectWhere,
    },
  });
  if (matchingProjectCount === 0) {
    notFound();
  }

  const stats = await getProjectStats(id);
  let projectLogs: ProjectDetailLog[] = [];

  try {
    projectLogs = await db.activityLog.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      take: 120,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  } catch {
    projectLogs = [];
  }

  const canCreateByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "CREATE",
    module: "PROJECT",
  });
  const canUpdateByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "UPDATE",
    module: "PROJECT",
  });
  const canEditByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "EDIT",
    module: "PROJECT",
  });
  const canDeleteByPermission = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "DELETE",
    module: "PROJECT",
  });
  const hasTaskManagementPermission =
    canCreateByPermission ||
    canUpdateByPermission ||
    canEditByPermission ||
    canDeleteByPermission;
  const canAssignMembers = canUpdateByPermission || canEditByPermission;
  const canUseProjectActions = canUpdateByPermission || canEditByPermission;
  const roleLimitedView =
    (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") &&
    (resolvedSearchParams.view === "details" || !resolvedSearchParams.view);
  const roleKanbanOnly =
    (session.user.role === "TEAMLEADER" || session.user.role === "EMPLOYEE") &&
    resolvedSearchParams.view === "kanban";
  const roleTeamOnly =
    session.user.role === "TEAMLEADER" && resolvedSearchParams.view === "team";
  const isAdmin = session.user.role === "ADMIN";
  const isBaViewer = session.user.role === "BA";
  const assignedTeamLeader = getAssignedTeamLeader(project);
  const projectTeamId = getProjectTaskTeamId(project);
  const responsibleLeadName = getProjectLeadName(project);
  const projectTaskCount = getProjectTaskCount(projectLogs);
  const adminTaskEmployees = isAdmin
    ? (await getEmployees())
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
        }))
    : [];

  if (isDetailsView) {
    return (
      <ProjectDetailView
        canEditByPermission={canEditByPermission}
        canUseProjectActions={canUseProjectActions}
        isAdmin={isAdmin}
        project={project}
        projectLogs={projectLogs}
        projectTaskCount={projectTaskCount}
        stats={stats}
      />
    );
  }

  if (isAdmin) {
    return (
      <ProjectAdminView
        adminTaskEmployees={adminTaskEmployees}
        assignedTeamLeaderName={assignedTeamLeader?.name ?? null}
        projectTeamId={projectTeamId}
        project={project}
        requestedDetailTab={requestedDetailTab}
        stats={stats}
      />
    );
  }

  if (isBaViewer) {
    return (
      <ProjectBaView
        canCreateByPermission={canCreateByPermission}
        canDeleteByPermission={canDeleteByPermission}
        canEditByPermission={canEditByPermission}
        canUpdateByPermission={canUpdateByPermission}
        hasTaskManagementPermission={hasTaskManagementPermission}
        project={project}
      />
    );
  }

  if (roleLimitedView) {
    redirect(`/projects/${project.id}?view=kanban`);
  }

  if (roleKanbanOnly) {
    return (
      <ProjectRoleKanbanView
        canCreateByPermission={canCreateByPermission}
        canDeleteByPermission={canDeleteByPermission}
        canEditByPermission={canEditByPermission}
        canUpdateByPermission={canUpdateByPermission}
        currentUserId={session.user.id}
        hasTaskManagementPermission={hasTaskManagementPermission}
        project={project}
        showTeamLink={session.user.role === "TEAMLEADER"}
      />
    );
  }

  if (roleTeamOnly) {
    return <ProjectRoleTeamView project={project} />;
  }

  return (
    <ProjectOverviewView
      canAssignMembers={canAssignMembers}
      canCreateByPermission={canCreateByPermission}
      canDeleteByPermission={canDeleteByPermission}
      canEditByPermission={canEditByPermission}
      canUpdateByPermission={canUpdateByPermission}
      canUseProjectActions={canUseProjectActions}
      currentUserId={session.user.id}
      currentUserRole={session.user.role}
      hasTaskManagementPermission={hasTaskManagementPermission}
      project={project}
      projectLogs={projectLogs}
      responsibleLeadName={responsibleLeadName}
      stats={stats}
    />
  );
}
