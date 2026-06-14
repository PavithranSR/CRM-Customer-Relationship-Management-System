import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmProjectTypeById } from "@/actions/crm-project-types.actions";
import { getCrmProjectById } from "@/actions/crm-projects.actions";
import { CrmModuleTopNav } from "@/components/crm/crm-module-top-nav";
import { CrmNewProjectForm, type CrmProjectFormInitialValues } from "@/components/crm/crm-new-project-form";

interface EditCrmProjectPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function EditCrmProjectPage({
  params,
  searchParams,
}: EditCrmProjectPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const query = await searchParams;
  const nextHref = query.next && query.next.startsWith("/") ? query.next : "/crm/quotations?tab=projects";

  const projectRecord = await getCrmProjectById(id);
  const projectType = projectRecord ? null : await getCrmProjectTypeById(id);

  if (!projectRecord && !projectType) {
    notFound();
  }

  const initialValues: CrmProjectFormInitialValues = projectRecord
    ? {
        recordType: "project",
        name: projectRecord.name,
        category: projectRecord.category,
        projectCode: projectRecord.projectCode,
        durationDays: projectRecord.durationDays,
        budgetAmount: projectRecord.price,
        gstPercent: projectRecord.gstPercent,
        status: projectRecord.status,
        createdDate: projectRecord.createdAt,
        description: projectRecord.description,
      }
    : {
        recordType: "project-type",
        name: projectType!.name,
        category: projectType!.category,
        projectCode: null,
        budgetAmount: projectType!.budget,
        gstPercent: projectType!.gstPercent,
        status: projectType!.status,
        createdDate: projectType!.createdAt,
        description: projectType!.description,
      };

  return (
    <div className="space-y-3">
      <CrmModuleTopNav activeItem="configuration" />
      <CrmNewProjectForm
        mode="edit"
        projectId={id}
        nextHref={nextHref}
        initialValues={initialValues}
      />
    </div>
  );
}
