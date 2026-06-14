import { redirect } from "next/navigation";
import { getProjects, getProjectStages } from "@/actions/project.actions";
import { auth, canAccessAction } from "@/lib/auth";
import { ProjectBoardView } from "@/components/projects/project-board-view";
import { db } from "@/lib/db";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { getAllCrmQuotations } from "@/actions/quotation.actions";
import { getAvailableProjectClientOptions } from "@/lib/project-client-options.server";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const hasProjectModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("PROJECT");

  if (!hasProjectModuleAccess) {
    redirect("/dashboard");
  }

  const projects = await getProjects(
    session.user.id,
    session.user.role,
    session.user.permissions
  );
  const stages = await getProjectStages();
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
  const canManageProjects = canUpdateByPermission || canEditByPermission;
  const canEditKanban = canUpdateByPermission || canEditByPermission;
  const canCreateProjects = session.user.role === "ADMIN";
  const canDeleteProjects = canDeleteByPermission;
  const [managerCandidates, quotationOptions] = await Promise.all([
    canCreateProjects
      ? db.user.findMany({
          where: {
            role: { in: ["BA", "TEAMLEADER"] },
            isActive: true,
          },
          select: { id: true, name: true, email: true, role: true, permissions: true },
        })
      : Promise.resolve([]),
    canCreateProjects
      ? getAllCrmQuotations()
      : Promise.resolve([]),
  ]);
  const managers = managerCandidates
    .filter((manager) =>
      normalizeEmployeePermissions(manager.permissions).moduleAccess.includes("PROJECT")
    )
    .map((manager) => ({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role,
    }));

  const clients = await getAvailableProjectClientOptions(quotationOptions);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <ProjectBoardView
          projects={projects}
          stages={stages}
          canManageProjects={canManageProjects}
          canEditKanban={canEditKanban}
          canCreateStages={canCreateByPermission}
          canUpdateStages={canEditByPermission}
          canDeleteStages={canDeleteByPermission}
          canDeleteProjects={canDeleteProjects}
          canEditProjects={canEditByPermission}
          canCreateProjects={canCreateProjects}
          projectManagers={managers}
          projectClients={clients}
          showTlDetailsMenu={
            session.user.role === "TEAMLEADER" ||
            session.user.role === "EMPLOYEE" ||
            session.user.role === "BA"
          }
        />
      </div>
    </div>
  );
}
