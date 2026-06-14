import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProjectForm } from "@/components/projects/project-form";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { getAllCrmQuotations } from "@/actions/quotation.actions";
import { getAvailableProjectClientOptions } from "@/lib/project-client-options.server";

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasProjectModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("PROJECT");
  const isAdmin = session.user.role === "ADMIN";

  if (!hasProjectModuleAccess || !isAdmin) {
    redirect("/dashboard");
  }

  const managerCandidates = await db.user.findMany({
    where: {
      role: { in: ["BA", "TEAMLEADER"] },
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });
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

  const quotationOptions = await getAllCrmQuotations();
  const clients = await getAvailableProjectClientOptions(quotationOptions);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Project</h1>
        <p className="text-muted-foreground">Create a new project</p>
      </div>

      <ProjectForm
        managers={managers}
        clients={clients}
        compactCreate
        formTitle="New Project"
        showStageOverview={false}
      />
    </div>
  );
}

