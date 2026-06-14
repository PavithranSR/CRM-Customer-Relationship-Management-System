import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCrmLead } from "@/actions/crm.actions";
import {
  getCrmQuotation,
  getDeletedQuotationInvoicesByQuotationId,
} from "@/actions/quotation.actions";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Button } from "@/components/ui/button";
import { resolveInternalBackHref } from "@/lib/internal-navigation";

interface DeletedInvoiceListPageProps {
  params: Promise<{ id: string; quotationId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

export default async function DeletedInvoiceListPage({ params, searchParams }: DeletedInvoiceListPageProps) {
  const { id, quotationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect(`/crm/${id}/quotations/${quotationId}`);
  }

  const [lead, quotation, deletedInvoices] = await Promise.all([
    getCrmLead(id),
    getCrmQuotation(quotationId),
    getDeletedQuotationInvoicesByQuotationId(quotationId),
  ]);

  if (!lead || !quotation || quotation.crmLeadId !== id) {
    notFound();
  }

  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const quotationHref = resolveInternalBackHref(
    resolvedSearchParams.from,
    `/crm/${id}/quotations/${quotationId}`,
  );

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="to-invoice" />

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
              Deleted Invoice List
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">{quotation.quotationNo}</h1>
            <p className="mt-2 text-sm text-slate-600">{quotation.projectTitle}</p>
            <p className="text-sm text-slate-600">{quotation.clientName} / {lead.phone || "-"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href={quotationHref}>Back to Quotation</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/crm/quotations?tab=to-invoice&deleted=1">Open All Deleted Invoices</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Deleted Invoices</h2>
            <p className="text-sm text-slate-500">Only deleted invoice records for this quotation are shown here.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
            {deletedInvoices.length} record{deletedInvoices.length === 1 ? "" : "s"}
          </div>
        </div>

        {deletedInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
            No deleted invoices found for this quotation.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-900">Invoice Ref</th>
                  <th className="p-4 font-semibold text-slate-900">Customer</th>
                  <th className="p-4 font-semibold text-slate-900">Salesperson</th>
                  <th className="p-4 font-semibold text-slate-900">Amount</th>
                  <th className="p-4 font-semibold text-slate-900">Deleted At</th>
                  <th className="p-4 font-semibold text-slate-900">Note</th>
                </tr>
              </thead>
              <tbody>
                {deletedInvoices.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200 last:border-b-0">
                    <td className="p-4 font-medium text-slate-950">{item.invoiceRef}</td>
                    <td className="p-4 text-slate-700">{item.clientName}</td>
                    <td className="p-4 text-slate-700">{item.salespersonName || "-"}</td>
                    <td className="p-4 text-slate-700">{currency.format(Number(item.totalAmount || 0))}</td>
                    <td className="p-4 text-slate-700">{new Date(item.deletedAt).toLocaleString()}</td>
                    <td className="p-4 text-slate-700">{item.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
