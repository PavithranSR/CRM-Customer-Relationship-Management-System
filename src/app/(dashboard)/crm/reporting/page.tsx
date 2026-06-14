import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmPivotReportingData, type CrmPivotReportingFilters } from "@/lib/crm-pivot-reporting";
import { CrmReportingPivot } from "@/components/crm/reporting/crm-reporting-pivot";

interface CrmReportingPageProps {
  searchParams: Promise<CrmPivotReportingFilters>;
}

export default async function CrmReportingPage({ searchParams }: CrmReportingPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" &&
      !session.user.moduleAccess.includes("CRM") &&
      !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const rawParams = await searchParams;
  const report = await getCrmPivotReportingData(rawParams, {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<div className="h-full rounded-md border bg-white p-4 text-sm text-slate-500">Loading reporting dashboard...</div>}>
          <CrmReportingPivot
            report={report}
            basePath="/crm/reporting"
          />
        </Suspense>
      </div>
    </div>
  );
}
