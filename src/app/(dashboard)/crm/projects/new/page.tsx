import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CrmModuleTopNav } from "@/components/crm/crm-module-top-nav";
import { CrmNewProjectForm } from "@/components/crm/crm-new-project-form";

interface NewCrmProjectPageProps {
  searchParams: Promise<{
    next?: string;
  }>;
}

export default async function NewCrmProjectPage({ searchParams }: NewCrmProjectPageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextHref = params.next && params.next.startsWith("/") ? params.next : "/crm/quotations?tab=projects";

  return (
    <div className="space-y-3">
      <CrmModuleTopNav activeItem="configuration" />
      <CrmNewProjectForm nextHref={nextHref} />
    </div>
  );
}
