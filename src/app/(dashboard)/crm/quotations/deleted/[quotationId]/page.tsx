import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Clock3, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import {
  getDeletedCrmQuotationDetail,
  getDeletedCrmQuotations,
} from "@/actions/quotation.actions";
import { CrmLeadArrowNav } from "@/components/crm/crm-lead-arrow-nav";
import { CrmQuotationExportButton } from "@/components/crm/crm-quotation-export-button";
import { DeletedQuotationDetailActions } from "@/components/crm/deleted-quotation-detail-actions";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Button } from "@/components/ui/button";

interface DeletedQuotationDetailPageProps {
  params: Promise<{ quotationId: string }>;
}

export default async function DeletedQuotationDetailPage({ params }: DeletedQuotationDetailPageProps) {
  const { quotationId } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect("/dashboard");
  }

  const [quotation, deletedQuotations] = await Promise.all([
    getDeletedCrmQuotationDetail(quotationId),
    getDeletedCrmQuotations(),
  ]);

  if (!quotation) {
    notFound();
  }

  const quotationIndex = deletedQuotations.findIndex((item) => item.quotationId === quotationId);
  const prevQuotationId = quotationIndex > 0 ? deletedQuotations[quotationIndex - 1]?.quotationId ?? null : null;
  const nextQuotationId =
    quotationIndex >= 0 && quotationIndex < deletedQuotations.length - 1
      ? deletedQuotations[quotationIndex + 1]?.quotationId ?? null
      : null;

  const currency = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  });
  const formatAmount = (value: number | null | undefined) => currency.format(Number(value ?? 0));
  const restoreDisabledReason = quotation.canRestore
    ? null
    : "This deleted quotation cannot be restored because its related CRM lead is no longer available.";

  return (
    <div className="space-y-4">
      <SalesSectionNav activeTab="orders" />

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <Trash2 className="h-4 w-4" />
                Deleted Quotation
              </div>
              <h1 className="mt-3 truncate text-3xl font-semibold text-slate-900">{quotation.quotationNo}</h1>
              <p className="mt-2 text-sm text-slate-500">
                This page shows only the important deleted quotation details, with export, restore, and permanent delete actions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link href="/crm/quotations?tab=quotations&deleted=1">Back to Deleted Quotations</Link>
              </Button>
              <CrmQuotationExportButton
                quotationNo={quotation.quotationNo}
                title={quotation.title}
                status={quotation.lastKnownStatus || quotation.status}
                sentAt={quotation.sentAt ? quotation.sentAt.toISOString() : null}
                createdAt={new Date(quotation.quotationCreatedAt).toISOString()}
                validUntil={quotation.validUntil ? quotation.validUntil.toISOString() : null}
                clientName={quotation.clientName}
                clientEmail={quotation.clientEmail || ""}
                clientPhone={null}
                projectTitle={quotation.projectTitle || quotation.title}
                serviceName={quotation.serviceName}
                unitName={quotation.unitName}
                unitCount={Number(quotation.unitCount || 1)}
                unitPrice={Number(quotation.unitPrice || quotation.totalAmount || 0)}
                gstPercent={Number(quotation.gstPercent || 0)}
                subtotalAmount={Number(quotation.subtotalAmount || quotation.totalAmount || 0)}
                gstAmount={Number(quotation.gstAmount || 0)}
                totalAmount={Number(quotation.totalAmount || 0)}
                terms={quotation.terms}
                notes={quotation.notes}
                items={quotation.items.map((item) => ({
                  name: item.name,
                  unitCount: item.unitCount,
                  amount: item.amount,
                  gstPercent: item.gstPercent,
                  tags: item.tags,
                }))}
              />
              <CrmLeadArrowNav
                currentCount={quotationIndex >= 0 ? quotationIndex + 1 : 1}
                totalCount={deletedQuotations.length}
                prevLeadId={prevQuotationId}
                nextLeadId={nextQuotationId}
                basePath="/crm/quotations/deleted"
              />
            </div>
          </div>

          {quotation.source === "legacy" ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  This deleted quotation comes from older delete history. Export and restore use the best available lead data.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DeletedQuotationDetailActions
              quotationId={quotation.quotationId}
              canRestore={quotation.canRestore}
              restoreDisabledReason={restoreDisabledReason}
            />
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border">
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Title</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{quotation.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Client</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.clientName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Client Email</p>
                  <p className="mt-1 break-words font-medium text-slate-900">{quotation.clientEmail || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Project</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.projectTitle || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Service</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.serviceName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Notes</p>
                  <p className="mt-1 min-h-16 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {quotation.notes || "No notes available."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Quotation No</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.quotationNo}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Salesperson</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.salespersonName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Last Active Status</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.lastKnownStatus || "DRAFT"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Deleted On</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {new Date(quotation.deletedAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Deleted By</p>
                  <p className="mt-1 font-medium text-slate-900">{quotation.deletedByName || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Terms</p>
                  <p className="mt-1 min-h-16 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {quotation.terms || "No terms available."}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t px-5 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Subtotal</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatAmount(quotation.subtotalAmount)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">GST</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatAmount(quotation.gstAmount)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{formatAmount(quotation.totalAmount)}</p>
                </div>
              </div>
            </div>

            <div className="border-t px-5 py-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">Line Items</h2>
                <span className="text-sm text-slate-500">{quotation.items.length} item(s)</span>
              </div>
              {quotation.items.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-slate-600">
                  Detailed line items are not available for this deleted quotation.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="p-3">Item</th>
                        <th className="p-3">Qty</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">GST %</th>
                        <th className="p-3">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotation.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="p-3 font-medium text-slate-900">{item.name}</td>
                          <td className="p-3">{item.unitCount}</td>
                          <td className="p-3">{formatAmount(item.amount)}</td>
                          <td className="p-3">{Number(item.gstPercent || 0).toFixed(2)}%</td>
                          <td className="p-3">{item.tags || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="self-start rounded-xl border p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock3 className="h-4 w-4" />
              <span className="text-sm font-medium">Record Timeline</span>
            </div>
            <div className="mt-4 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Created</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(quotation.quotationCreatedAt).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Deleted</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(quotation.deletedAt).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-red-50 p-4">
              <p className="text-xs text-red-500">Deleted Status</p>
              <p className="mt-1 text-sm font-medium text-red-700">
                This quotation remains deleted until it is restored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
