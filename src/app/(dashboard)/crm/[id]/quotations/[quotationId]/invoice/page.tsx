import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmQuotation, getQuotationInvoice, getQuotationPayments } from "@/actions/quotation.actions";
import { getActivityLogs } from "@/actions/activity-log.actions";
import { CrmDetailPageShell } from "@/components/crm/crm-detail-page-shell";
import { CrmInvoiceActionsMenu } from "@/components/crm/crm-invoice-actions-menu";
import { CrmInvoiceChatter } from "@/components/crm/crm-invoice-chatter";
import { CrmInvoiceToolbar } from "@/components/crm/crm-invoice-toolbar";
import { CrmPaymentRecords } from "@/components/crm/crm-payment-records";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveInternalBackHref, withInternalBackHref } from "@/lib/internal-navigation";

interface CrmQuotationInvoicePageProps {
  params: Promise<{ id: string; quotationId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

export default async function CrmQuotationInvoicePage({ params, searchParams }: CrmQuotationInvoicePageProps) {
  const { id, quotationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const lead = await getCrmLead(id);
  const quotation = await getCrmQuotation(quotationId);
  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const invoice = await getQuotationInvoice(quotationId);
  if (!invoice && quotation.status !== "SENT") {
    redirect(`/crm/${id}/quotations/${quotationId}`);
  }

  const paymentRecords = await getQuotationPayments(quotationId);
  const invoiceLogs = invoice
    ? await getActivityLogs({ entityType: "crm_invoice", entityId: invoice.id, limit: 20 })
    : [];
  const quotationLogs = await getActivityLogs({ entityType: "crm_quotation", entityId: quotationId, limit: 20 });
  const logs = [...invoiceLogs, ...quotationLogs]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);
  const serializedActivityLogs = logs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    createdByName: log.createdBy?.name || null,
    metadata:
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : null,
  }));

  const invoiceNumber = `INV/${new Date(quotation.createdAt).getFullYear()}/${quotation.quotationNo.replace("QT-", "")}`;
  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const formatCurrency = (value: number | null | undefined) =>
    value === null || value === undefined ? "-" : currency.format(value);
  const unitLabel = quotation.unitName || quotation.serviceName || "Service Item";
  const invoiceDate = new Date(invoice?.updatedAt || quotation.updatedAt);
  const dueDate = quotation.validUntil ? new Date(quotation.validUntil) : null;
  const totalAmount = Number(quotation.totalAmount || 0);
  const unitCount = Number(quotation.unitCount || 0);
  const unitPrice = Number(quotation.unitPrice || 0);
  const gstPercent = Number(quotation.gstPercent || 0);
  const subtotalAmount = Number(quotation.subtotalAmount || 0);
  const paidAmount = paymentRecords.reduce((sum, payment) => sum + Number(payment.paidAmount || 0), 0);
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const lastPaymentType = paymentRecords[0]?.paymentType ?? invoice?.paymentType ?? "-";
  const now = new Date();
  const hasDueDatePassed = dueDate ? new Date(dueDate).getTime() < now.getTime() : false;
  const invoiceStatus =
    paidAmount >= totalAmount && totalAmount > 0
      ? "Paid"
      : paidAmount > 0
        ? "Partial"
        : hasDueDatePassed
          ? "Overdue"
          : "Unpaid";
  const invoiceBackHref = resolveInternalBackHref(resolvedSearchParams.from, "/crm/quotations?tab=to-invoice");
  const invoiceHref = withInternalBackHref(`/crm/${id}/quotations/${quotationId}/invoice`, invoiceBackHref);

  return (
    <CrmDetailPageShell>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">Customer Invoice</h1>
            <CrmInvoiceActionsMenu quotationId={quotationId} align="start" />
          </div>
          <p className="text-sm text-slate-600">{invoiceNumber}</p>
          <div className="mt-2">
            <CrmQuotationNav
              leadId={id}
              backHref={invoiceBackHref}
              forceBackHref
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-md border bg-slate-50 px-3 py-1 text-sm font-medium">{invoiceStatus}</div>
        </div>
      </div>

      <div className="rounded-md border bg-white p-4">
        <CrmInvoiceToolbar
          leadId={id}
          quotationId={quotationId}
          invoiceHref={invoiceHref}
          canCreateInvoice={quotation.status === "SENT"}
          invoiceNumber={invoiceNumber}
          quotationNo={quotation.quotationNo}
          invoiceDate={invoiceDate.toISOString()}
          dueDate={dueDate ? dueDate.toISOString() : null}
          paymentType={String(lastPaymentType)}
          clientName={quotation.clientName}
          clientEmail={quotation.clientEmail}
          clientPhone={lead.phone || null}
          projectTitle={quotation.projectTitle}
          productName={quotation.serviceName || "Service"}
          unitLabel={unitLabel}
          quantity={unitCount}
          unitPrice={unitPrice}
          gstPercent={gstPercent}
          subtotalAmount={subtotalAmount}
          totalAmount={totalAmount}
          paidAmount={paidAmount}
          balanceAmount={balanceAmount}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <div className="rounded-lg border border-slate-200/80 bg-slate-50/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Name</span>
                    <span className="max-w-[60%] truncate text-right font-semibold text-slate-900">{quotation.clientName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Email</span>
                    <span className="max-w-[60%] truncate text-right font-medium text-slate-900">{quotation.clientEmail}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Phone</span>
                    <span className="text-right font-medium text-slate-900">{lead.phone || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Project</span>
                    <span className="max-w-[60%] truncate text-right font-medium text-slate-900">{quotation.projectTitle}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invoice Summary</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Invoice No</span>
                    <span className="max-w-[60%] truncate text-right font-medium text-slate-900">{invoiceNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Status</span>
                    <span className="text-right font-medium text-slate-900">{invoiceStatus}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-2">
                    <span className="text-slate-500">Paid Amount</span>
                    <span className="text-right font-medium text-slate-900">{currency.format(paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">Balance</span>
                    <span className="text-right font-semibold text-slate-900">{currency.format(balanceAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="lines">
              <TabsList variant="line">
                <TabsTrigger value="lines">Invoice Lines</TabsTrigger>
                <TabsTrigger value="other">Other Info</TabsTrigger>
              </TabsList>
              <TabsContent value="lines" className="mt-3">
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="border-b text-left">
                        <th className="p-3">Product</th>
                        <th className="p-3">Label</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Unit Price</th>
                        <th className="p-3">GST</th>
                        <th className="p-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-3">{quotation.serviceName || "Service"}</td>
                        <td className="p-3">{unitLabel}</td>
                        <td className="p-3">{quotation.unitCount ?? "-"}</td>
                        <td className="p-3">{formatCurrency(quotation.unitPrice)}</td>
                        <td className="p-3">{quotation.gstPercent === null ? "-" : `${quotation.gstPercent}%`}</td>
                        <td className="p-3">{formatCurrency(quotation.subtotalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="other" className="mt-3">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-slate-500">Terms and Conditions</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {quotation.terms || "No terms specified"}
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="rounded-md border bg-white p-4">
              <h2 className="mb-3 text-lg font-semibold">Payment Records</h2>
              <CrmPaymentRecords leadId={id} quotationId={quotationId} invoiceHref={invoiceHref} records={paymentRecords} />
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <CrmInvoiceChatter
            quotationId={quotationId}
            currentUserName={session.user.name || session.user.email || "User"}
            initialLogs={serializedActivityLogs}
          />
        </div>
      </div>
    </CrmDetailPageShell>
  );
}
