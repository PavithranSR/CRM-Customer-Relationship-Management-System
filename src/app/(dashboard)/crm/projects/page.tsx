import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmProjectTypes } from "@/actions/crm-project-types.actions";
import { CrmProjectTypesManager } from "@/components/crm/crm-project-types-manager";

export default async function CrmProjectsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const items = await getCrmProjectTypes();

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-slate-50 p-4">
        <h1 className="text-2xl font-semibold">Project Types & Budgets</h1>
        <p className="text-sm text-slate-600">Create and manage project type entries with budget values.</p>
      </div>

      <Suspense fallback={<div className="rounded-md border bg-white p-4 text-sm text-slate-500">Loading project types...</div>}>
        <CrmProjectTypesManager items={items} />
      </Suspense>
    </div>
  );
}
