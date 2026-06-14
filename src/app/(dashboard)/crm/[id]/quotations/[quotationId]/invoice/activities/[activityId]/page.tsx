import Link from "next/link";
import { Prisma } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { getCrmLead } from "@/actions/crm.actions";
import { getCrmQuotation, getQuotationInvoice } from "@/actions/quotation.actions";
import { SalesSectionNav } from "@/components/crm/sales-section-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveInternalBackHref, withInternalBackHref } from "@/lib/internal-navigation";

interface CrmInvoiceActivityDetailPageProps {
  params: Promise<{ id: string; quotationId: string; activityId: string }>;
  searchParams?: Promise<{ from?: string }>;
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMetadataValue(value: Prisma.JsonValue): string {
  if (value === null) {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatMetadataValue(item)).join(", ");
  }

  return JSON.stringify(value);
}

function getEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    crm_invoice: "Invoice",
    crm_quotation: "Quotation",
    crm_payment: "Payment",
  };

  return labels[entityType] || formatLabel(entityType);
}

export default async function CrmInvoiceActivityDetailPage({
  params,
  searchParams,
}: CrmInvoiceActivityDetailPageProps) {
  const { id, quotationId, activityId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("SALES"))
  ) {
    redirect(`/crm/${id}/quotations/${quotationId}/invoice`);
  }

  const [lead, quotation, invoice, activity] = await Promise.all([
    getCrmLead(id),
    getCrmQuotation(quotationId),
    getQuotationInvoice(quotationId),
    db.activityLog.findFirst({
      where: { id: activityId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  if (!lead || !quotation || quotation.crmLeadId !== id || !activity) {
    notFound();
  }

  const metadata =
    activity.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata)
      ? activity.metadata
      : null;
  const metadataQuotationId =
    metadata && typeof metadata.quotationId === "string" ? metadata.quotationId : null;

  const belongsToCurrentRecord =
    (activity.entityType === "crm_quotation" && activity.entityId === quotationId) ||
    (activity.entityType === "crm_invoice" &&
      ((invoice && activity.entityId === invoice.id) || metadataQuotationId === quotationId));

  if (!belongsToCurrentRecord) {
    notFound();
  }

  const metadataEntries = metadata
    ? Object.entries(metadata).map(([key, value]) => ({
        label: formatLabel(key),
        value: formatMetadataValue(value as Prisma.JsonValue),
      }))
    : [];
  const createdAtLabel = new Date(activity.createdAt).toLocaleString();
  const invoiceHref = resolveInternalBackHref(
    resolvedSearchParams.from,
    `/crm/${id}/quotations/${quotationId}/invoice`,
  );
  const quotationHref = withInternalBackHref(`/crm/${id}/quotations/${quotationId}`, invoiceHref);

  return (
    <div className="space-y-5">
      <SalesSectionNav activeTab="to-invoice" />

      <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_50%,#fffaf2_100%)] p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Activity Detail
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                {getEntityLabel(activity.entityType)} {formatEnumLabel(activity.action)}
              </h1>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
                {activity.action}
              </Badge>
            </div>
            <div className="space-y-1 text-sm text-slate-600">
              <p>{quotation.clientName}</p>
              <p>{quotation.quotationNo} / {quotation.projectTitle}</p>
              <p>Recorded on {createdAtLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={invoiceHref}>Back to Invoice</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={quotationHref}>Open Quotation</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <div className="space-y-5">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.5)]">
            <h2 className="text-xl font-semibold text-slate-950">Summary</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Action</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{formatEnumLabel(activity.action)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Record</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{getEntityLabel(activity.entityType)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Created By</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{activity.createdBy?.name || "User"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Created At</p>
                <p className="mt-3 text-lg font-semibold text-slate-950">{createdAtLabel}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.5)]">
            <h2 className="text-xl font-semibold text-slate-950">Metadata</h2>
            {metadataEntries.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                No extra activity metadata available.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {metadataEntries.map((entry, index) => (
                  <div key={`${entry.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{entry.label}</p>
                    <p className="mt-3 break-words text-base font-semibold text-slate-950">{entry.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.5)]">
          <h2 className="text-xl font-semibold text-slate-950">Details</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium">{quotation.clientName}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Email</span>
              <span className="font-medium">{quotation.clientEmail}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Phone</span>
              <span className="font-medium">{lead.phone || "-"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Project</span>
              <span className="font-medium">{quotation.projectTitle}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Quotation No</span>
              <span className="font-medium">{quotation.quotationNo}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Activity ID</span>
              <span className="font-medium">{activity.id}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Entity ID</span>
              <span className="font-medium">{activity.entityId}</span>
            </div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-slate-500">Performed By</span>
              <span className="font-medium">{activity.createdBy?.email || activity.createdBy?.name || "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Linked User</span>
              <span className="font-medium">{activity.user?.name || activity.user?.email || "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
