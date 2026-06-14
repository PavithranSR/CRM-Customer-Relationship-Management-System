import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth, canAccessAction } from "@/lib/auth";
import {
  getCrmQuotation,
  getQuotationInvoice,
  getQuotationPaymentById,
} from "@/actions/quotation.actions";
import { getCrmLead } from "@/actions/crm.actions";
import { CrmDetailPageShell } from "@/components/crm/crm-detail-page-shell";
import { CrmPaymentDetailActions } from "@/components/crm/crm-payment-detail-actions";
import { Button } from "@/components/ui/button";
import { resolveInternalBackHref, withInternalBackHref } from "@/lib/internal-navigation";

interface CrmPaymentDetailPageProps {
  params: Promise<{ id: string; quotationId: string; paymentId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

function parsePaymentNotes(notes: string | null) {
  return (notes || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separatorIndex = part.indexOf(":");
      if (separatorIndex === -1) {
        return { label: "Note", value: part };
      }
      return {
        label: part.slice(0, separatorIndex).trim(),
        value: part.slice(separatorIndex + 1).trim(),
      };
    });
}

export default async function CrmPaymentDetailPage({ params, searchParams }: CrmPaymentDetailPageProps) {
  const { id, quotationId, paymentId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect(`/crm/${id}/quotations/${quotationId}/invoice`);
  }

  const [lead, quotation, invoice, payment] = await Promise.all([
    getCrmLead(id),
    getCrmQuotation(quotationId),
    getQuotationInvoice(quotationId),
    getQuotationPaymentById(paymentId),
  ]);

  if (!lead || !quotation || quotation.crmLeadId !== id || !payment || payment.quotationId !== quotationId) {
    notFound();
  }

  const noteRows = parsePaymentNotes(payment.notes);
  const canDeletePayment = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "DELETE",
    module: "SALES",
  });
  const canEditPayment = canAccessAction({
    role: session.user.role,
    permissions: session.user.permissions,
    action: "UPDATE",
    module: "SALES",
  });
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const paymentCreatedLabel = new Date(payment.createdAt).toLocaleString();
  const paymentUpdatedLabel = new Date(payment.updatedAt).toLocaleString();
  const quotationTotalLabel = currency.format(Number(payment.quotationTotalAmount || quotation.totalAmount || 0));
  const invoiceBalanceLabel = currency.format(Number(invoice?.balanceAmount ?? payment.invoiceBalanceAmount ?? 0));
  const paidAmountLabel = currency.format(Number(payment.paidAmount || 0));
  const invoiceStatusLabel = invoice ? "Created" : "Pending";

  const paymentInputLabel =
    payment.paymentType === "PERCENTAGE"
      ? `${Number(payment.percentage || 0).toFixed(2)}%`
      : payment.paymentType === "MONTHLY"
        ? `${currency.format(Number(payment.amount || 0))} x ${payment.months || 1}`
        : currency.format(Number(payment.amount || 0));
  const invoiceHref = resolveInternalBackHref(
    resolvedSearchParams.from,
    `/crm/${id}/quotations/${quotationId}/invoice`,
  );
  const quotationHref = withInternalBackHref(`/crm/${id}/quotations/${quotationId}`, invoiceHref);

  return (
    <CrmDetailPageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payment Detail</h1>
          <p className="text-sm text-slate-600">{quotation.quotationNo}</p>
          <p className="text-sm text-slate-600">{quotation.projectTitle}</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button asChild variant="outline">
            <Link href={invoiceHref}>Back to Invoice</Link>
          </Button>
          <div className="rounded-md border bg-slate-50 px-3 py-1 text-sm font-medium">{payment.paymentType}</div>
          <CrmPaymentDetailActions
            canDelete={canDeletePayment}
            canEdit={canEditPayment}
            backHref={invoiceHref}
            paymentId={payment.id}
            leadId={id}
            quotationId={quotationId}
            quotationNo={quotation.quotationNo}
            paymentType={payment.paymentType}
            amount={Number(payment.amount || 0)}
            percentage={payment.percentage}
            months={payment.months}
            notesText={payment.notes || ""}
            paidAmountLabel={paidAmountLabel}
            recordedAtLabel={paymentCreatedLabel}
            customerName={quotation.clientName}
            projectTitle={quotation.projectTitle}
            notes={noteRows}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Name</span>
                <span className="max-w-[60%] text-right font-semibold text-slate-900">{quotation.clientName}</span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Email</span>
                <span className="max-w-[60%] break-all text-right font-medium text-slate-900">{quotation.clientEmail}</span>
              </div>
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">Phone</span>
                <span className="text-right font-medium text-slate-900">{lead.phone || "-"}</span>
              </div>
              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Project</span>
                <span className="max-w-[60%] text-right font-medium text-slate-900">{quotation.projectTitle}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200/80 p-4 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
              <span className="text-slate-500">Recorded On</span>
              <span className="text-right font-medium text-slate-900">{paymentCreatedLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
              <span className="text-slate-500">Updated On</span>
              <span className="text-right font-medium text-slate-900">{paymentUpdatedLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
              <span className="text-slate-500">Payment Type</span>
              <span className="text-right font-medium text-slate-900">{payment.paymentType}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
              <span className="text-slate-500">Input Value</span>
              <span className="text-right font-medium text-slate-900">{paymentInputLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-2">
              <span className="text-slate-500">Quotation No</span>
              <Link href={quotationHref} className="text-right font-medium text-slate-900 hover:underline">
                {quotation.quotationNo}
              </Link>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Invoice Status</span>
              <span className="text-right font-medium text-slate-900">{invoiceStatusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Paid Amount</p>
            <p className="text-lg font-semibold">{paidAmountLabel}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Input</p>
            <p className="text-lg font-semibold">{paymentInputLabel}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Quotation Total</p>
            <p className="text-lg font-semibold">{quotationTotalLabel}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-slate-500">Balance</p>
            <p className="text-lg font-semibold">{invoiceBalanceLabel}</p>
          </div>
        </div>
      </div>

    </CrmDetailPageShell>
  );
}
