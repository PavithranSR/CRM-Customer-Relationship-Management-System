import { getProjectCategoryFromTags, createInrFormatter } from "./helpers";
import type { CrmQuotationDetailItem, CrmQuotationDetailQuotation } from "./types";

interface CrmQuotationDetailSummaryProps {
  items: CrmQuotationDetailItem[];
  quotation: CrmQuotationDetailQuotation;
}

export function CrmQuotationDetailSummary({
  items,
  quotation,
}: CrmQuotationDetailSummaryProps) {
  const currency = createInrFormatter();
  const formatAmount = (value: number | null | undefined) => currency.format(Number(value ?? 0));
  const projectCategories = Array.from(
    new Set(
      items
        .map((item) => getProjectCategoryFromTags(item.tags))
        .filter((value): value is string => Boolean(value))
    )
  );

  return (
    <div className="rounded-md border bg-white p-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-xs text-slate-500">Client</p>
          <p className="font-medium">{quotation.clientName}</p>
          <p className="text-sm text-slate-600">{quotation.clientEmail}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Service</p>
          <p className="font-medium">{quotation.serviceName || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Project Category</p>
          <p className="font-medium">{projectCategories.length > 0 ? projectCategories.join(", ") : "-"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Subtotal</p>
          <p className="text-lg font-semibold">{formatAmount(quotation.subtotalAmount)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">GST</p>
          <p className="text-lg font-semibold">{formatAmount(quotation.gstAmount)}</p>
        </div>
        <div className="rounded-md border p-3">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-lg font-semibold">{formatAmount(quotation.totalAmount)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs text-slate-500">Terms</p>
          <p className="whitespace-pre-wrap text-sm">{quotation.terms || "-"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Notes</p>
          <p className="whitespace-pre-wrap text-sm">{quotation.notes || "-"}</p>
        </div>
      </div>

    </div>
  );
}

