import { notFound, redirect } from "next/navigation";
import { auth, canAccessAction } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import {
  getAllCrmQuotations,
  getCrmQuotation,
  getDeletedQuotationInvoiceByQuotationId,
  getQuotationInvoice,
  getQuotationItems,
  getQuotationPayments,
} from "@/actions/quotation.actions";
import { CrmDetailPageShell } from "@/components/crm/crm-detail-page-shell";
import { CrmQuotationDetailDownPayment } from "@/components/crm/quotation-detail-page/down-payment";
import { CrmQuotationDetailHeader } from "@/components/crm/quotation-detail-page/header";
import { CrmQuotationDetailHero } from "@/components/crm/quotation-detail-page/hero";
import { isDatabaseConnectionError } from "@/components/crm/quotation-detail-page/helpers";
import { CrmQuotationDetailLoadError } from "@/components/crm/quotation-detail-page/load-error";
import { CrmQuotationDetailSummary } from "@/components/crm/quotation-detail-page/summary";
import type { CrmQuotationDetailPageProps } from "@/components/crm/quotation-detail-page/types";
import { resolveInternalBackHref, withInternalBackHref } from "@/lib/internal-navigation";

export default async function CrmQuotationDetailPage({
  params,
  searchParams,
}: CrmQuotationDetailPageProps) {
  const { id, quotationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  let lead: Awaited<ReturnType<typeof getCrmLead>> | null = null;
  let quotation: Awaited<ReturnType<typeof getCrmQuotation>> | null = null;
  let items: Awaited<ReturnType<typeof getQuotationItems>> = [];
  let invoice: Awaited<ReturnType<typeof getQuotationInvoice>> | null = null;
  let deletedInvoice: Awaited<ReturnType<typeof getDeletedQuotationInvoiceByQuotationId>> | null = null;
  let payments: Awaited<ReturnType<typeof getQuotationPayments>> = [];
  let allQuotations: Awaited<ReturnType<typeof getAllCrmQuotations>> = [];

  try {
    const [leadResult, quotationResult] = await Promise.all([
      getCrmLead(id),
      getCrmQuotation(quotationId),
    ]);
    lead = leadResult;
    quotation = quotationResult;

    if (leadResult && quotationResult && quotationResult.crmLeadId === id) {
      [items, invoice, deletedInvoice, payments, allQuotations] = await Promise.all([
        getQuotationItems(quotationId),
        getQuotationInvoice(quotationId),
        getDeletedQuotationInvoiceByQuotationId(quotationId),
        getQuotationPayments(quotationId),
        getAllCrmQuotations(),
      ]);
    }
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      return <CrmQuotationDetailLoadError />;
    }
    throw error;
  }

  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const totalAmount = Number(quotation.totalAmount || 0);
  const paidAmount = payments.reduce((sum, payment) => sum + (payment.paidAmount ?? 0), 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const currentQuotationIndex = Math.max(
    0,
    allQuotations.findIndex((item) => item.id === quotation.id)
  );
  const previousQuotation =
    currentQuotationIndex > 0 ? allQuotations[currentQuotationIndex - 1] : null;
  const nextQuotation =
    currentQuotationIndex >= 0 && currentQuotationIndex < allQuotations.length - 1
      ? allQuotations[currentQuotationIndex + 1]
      : null;

  const canUpdateQuotation = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "UPDATE",
    module: "SALES",
  });
  const canDeleteQuotation = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "DELETE",
    module: "SALES",
  });
  const canCreateInvoice = quotation.status === "SENT";
  const quotationBackHref = resolveInternalBackHref(
    resolvedSearchParams.from,
    "/crm/quotations?tab=quotations"
  );
  const quotationHref = withInternalBackHref(
    `/crm/${id}/quotations/${quotation.id}`,
    quotationBackHref
  );
  const invoiceHref = withInternalBackHref(
    `/crm/${id}/quotations/${quotation.id}/invoice`,
    quotationHref
  );
  const deletedInvoiceHref = withInternalBackHref(
    `/crm/${id}/quotations/${quotation.id}/deleted-invoice`,
    quotationHref
  );
  const previousHref = previousQuotation
    ? withInternalBackHref(
        `/crm/${previousQuotation.crmLeadId}/quotations/${previousQuotation.id}`,
        quotationBackHref
      )
    : null;
  const nextHref = nextQuotation
    ? withInternalBackHref(
        `/crm/${nextQuotation.crmLeadId}/quotations/${nextQuotation.id}`,
        quotationBackHref
      )
    : null;
  const headerTitle =
    lead.title || quotation.projectTitle || quotation.title || quotation.quotationNo;

  return (
    <CrmDetailPageShell
      header={
        <CrmQuotationDetailHeader
          currentIndex={currentQuotationIndex}
          deletedInvoiceHref={deletedInvoiceHref}
          displayTitle={headerTitle}
          nextHref={nextHref}
          previousHref={previousHref}
          quotationNewHref={`/crm/${id}/quotations/new`}
          total={allQuotations.length}
        />
      }
    >
      <div className="space-y-4">
        <CrmQuotationDetailHero
          canCreateInvoice={canCreateInvoice}
          canDeleteQuotation={canDeleteQuotation}
          canUpdateQuotation={canUpdateQuotation}
          crmLeadId={id}
          deletedInvoice={deletedInvoice}
          deletedInvoiceHref={deletedInvoiceHref}
          invoice={invoice}
          invoiceHref={invoiceHref}
          items={items}
          lead={lead}
          quotation={quotation}
          quotationBackHref={quotationBackHref}
          quotationHref={quotationHref}
        />
        <CrmQuotationDetailSummary items={items} quotation={quotation} />
        <CrmQuotationDetailDownPayment
          balanceAmount={balanceAmount}
          canCreateInvoice={canCreateInvoice}
          invoice={invoice}
          invoiceHref={invoiceHref}
          paidAmount={paidAmount}
          payments={payments}
        />
      </div>
    </CrmDetailPageShell>
  );
}
