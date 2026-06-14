import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmQuotation, getQuotationPayments } from "@/actions/quotation.actions";
import { CrmDetailPageShell } from "@/components/crm/crm-detail-page-shell";
import { CrmInvoiceForm } from "@/components/crm/crm-invoice-form";
import { CrmQuotationConfirmButton } from "@/components/crm/crm-quotation-confirm-button";
import { Button } from "@/components/ui/button";
import { resolveInternalBackHref } from "@/lib/internal-navigation";

interface CrmCreateInvoicePageProps {
  params: Promise<{ id: string; quotationId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

export default async function CrmCreateInvoicePage({ params, searchParams }: CrmCreateInvoicePageProps) {
  const { id, quotationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect(`/crm/${id}/quotations/${quotationId}`);
  }

  const lead = await getCrmLead(id);
  const quotation = await getCrmQuotation(quotationId);
  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const paymentRecords = await getQuotationPayments(quotationId);
  const paidAmount = paymentRecords.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const quotationTotal = Number(quotation.totalAmount || 0);
  const balanceAmount = Math.max(quotationTotal - paidAmount, 0);
  const invoiceHref = resolveInternalBackHref(
    resolvedSearchParams.from,
    `/crm/${id}/quotations/${quotationId}/invoice`,
  );

  return (
    <CrmDetailPageShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Create Invoice</h1>
          <p className="text-sm text-slate-600">{quotation.quotationNo}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={invoiceHref}>Back to Invoice</Link>
        </Button>
      </div>

      {quotation.status !== "SENT" ? (
        <div className="rounded-md border bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Confirm quotation first</h2>
          <p className="mt-2 text-sm text-slate-600">
            Invoice creation is available only after this quotation is confirmed.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <CrmQuotationConfirmButton
              quotationId={quotationId}
              crmLeadId={id}
              quotationHref={`/crm/${id}/quotations/${quotationId}`}
            />
            <Button asChild variant="outline">
              <Link href={`/crm/${id}/quotations/${quotationId}`}>Back to Quotation</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border bg-white p-4">
          <CrmInvoiceForm
            quotationId={quotationId}
            quoteTotal={quotationTotal}
            currentPaid={paidAmount}
            currentBalance={balanceAmount}
          />
        </div>
      )}
    </CrmDetailPageShell>
  );
}
