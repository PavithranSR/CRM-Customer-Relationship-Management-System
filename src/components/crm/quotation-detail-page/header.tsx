import Link from "next/link";
import { CrmQuotationSettingsMenu } from "@/components/crm/crm-quotation-settings-menu";
import { QuotationRecordNavigator } from "@/components/crm/quotation-record-navigator";
import { Button } from "@/components/ui/button";

interface CrmQuotationDetailHeaderProps {
  currentIndex: number;
  deletedInvoiceHref: string;
  displayTitle: string;
  nextHref: string | null;
  previousHref: string | null;
  quotationNewHref: string;
  total: number;
}

export function CrmQuotationDetailHeader({
  currentIndex,
  deletedInvoiceHref,
  displayTitle,
  nextHref,
  previousHref,
  quotationNewHref,
  total,
}: CrmQuotationDetailHeaderProps) {
  return (
    <div className="rounded-md border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="outline" size="sm" className="rounded-md">
            <Link href={quotationNewHref}>New</Link>
          </Button>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-cyan-700">Quotations</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-2">
              <p className="truncate text-lg font-medium text-slate-900 sm:text-xl">{displayTitle}</p>
              <CrmQuotationSettingsMenu deletedInvoiceHref={deletedInvoiceHref} />
            </div>
          </div>
        </div>
        <QuotationRecordNavigator
          currentIndex={currentIndex}
          total={total}
          previousHref={previousHref}
          nextHref={nextHref}
        />
      </div>
    </div>
  );
}

