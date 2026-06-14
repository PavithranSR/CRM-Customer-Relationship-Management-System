import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProject } from "@/actions/project.actions";
import { ProjectForm } from "@/components/projects/project-form";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

interface EditProjectPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    redirect("/dashboard");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const managers = await db.user.findMany({
    where: { role: { in: ["BA", "TEAMLEADER"] }, isActive: true },
    select: { id: true, name: true, email: true, role: true, permissions: true },
  });
  const projectLeadOptions = managers
    .filter((manager) =>
      normalizeEmployeePermissions(manager.permissions).moduleAccess.includes("PROJECT")
    )
    .map((manager) => ({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      role: manager.role,
    }));

  const clients = await db.client.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      serviceName: true,
      projectName: true,
      tags: true,
      phone: true,
      country: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Project</h1>
        <p className="text-muted-foreground">Update project information</p>
      </div>

      <ProjectForm
        project={project}
        managers={projectLeadOptions}
        clients={clients}
        formTitle="Edit Project"
        showStageOverview={false}
      />
    </div>
  );
}

