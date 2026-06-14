import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmReportingData, type CrmReportingFilters } from "@/lib/crm-reporting";
import { CrmReportingContent } from "@/components/crm/reporting/crm-reporting-content";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";

interface SalesReportingPageProps {
  searchParams: Promise<CrmReportingFilters>;
}

export default async function SalesReportingPage({ searchParams }: SalesReportingPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const rawParams = await searchParams;
  const params: CrmReportingFilters = {
    ...rawParams,
    section: rawParams.section === "invoices" ? "invoices" : "quotations",
  };
  const report = await getCrmReportingData(params, {
    id: session.user.id,
    role: session.user.role,
    permissions: session.user.permissions,
  }, {
    basePath: "/crm/quotations/reporting",
  });

  return (
    <div className="space-y-4">
      <SalesSectionNav
        activeTab="reporting"
        hrefs={{ reporting: "/crm/quotations/reporting" }}
      />
      <CrmReportingContent
        report={report}
        basePath="/crm/quotations/reporting"
        exportBasePath="/api/crm-reporting/export"
        showFilters={false}
        visibleSections={["quotations", "invoices"]}
        title="Sales Reporting"
        description="Quotation, invoice, and revenue reporting for the sales module."
      />
    </div>
  );
}
