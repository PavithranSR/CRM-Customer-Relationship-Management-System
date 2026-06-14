"use client";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteCrmQuotations } from "@/actions/quotation.actions";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";
import {
  applyInvoiceFirstDeleteNotice,
  clearQuotationDeleteNotice,
} from "@/lib/quotation-delete-notice";

interface SalesSummaryRow {
  key: string;
  name: string;
  count: number;
  totalLabel: string;
  lastDateLabel: string;
  quotationIds: string[];
  quotationsHref: string;
}

interface SalesSummaryListTableProps {
  rows: SalesSummaryRow[];
  firstColumnLabel: string;
  emptyText: string;
  canDelete?: boolean;
}

export function SalesSummaryListTable({
  rows,
  firstColumnLabel,
  emptyText,
  canDelete = true,
}: SalesSummaryListTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const invoiceBlockedMessage = "Remove invoice first, then remove quotation";

  const updateListUrl = useCallback((nextParams: URLSearchParams, scrollToTop = false) => {
    const nextQuery = nextParams.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;

    if (nextUrl === currentUrl) {
      router.refresh();
      return;
    }

    router.replace(nextUrl, { scroll: scrollToTop });
  }, [currentSearch, pathname, router]);

  const runDelete = useCallback(async (selectedRows: SalesSummaryRow[]) => {
    const quotationIds = Array.from(new Set(selectedRows.flatMap((row) => row.quotationIds)));
    if (quotationIds.length === 0) {
      toast.error("Select at least one row");
      return;
    }

    const result = await bulkDeleteCrmQuotations(quotationIds);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const errorList = Array.isArray(result.errors) ? result.errors.filter(Boolean) : [];
    const invoiceBlockedCount = errorList.filter((error) => error === invoiceBlockedMessage).length;
    const hasInvoiceBlockedRows = invoiceBlockedCount > 0;
    const otherErrors = errorList.filter((error) => error !== invoiceBlockedMessage);

    if ((result.deletedCount || 0) > 0) {
      toast.success(`${result.deletedCount} quotation(s) deleted`);
    }

    if (otherErrors.length > 0) {
      const firstReason = otherErrors[0] ? `: ${otherErrors[0]}` : "";
      const otherErrorPrefix = hasInvoiceBlockedRows
        ? "Some quotations could not be deleted"
        : `${result.blockedCount || otherErrors.length} quotation(s) could not be deleted`;
      toast.error(`${otherErrorPrefix}${firstReason}`);
    }

    const nextParams = hasInvoiceBlockedRows
      ? applyInvoiceFirstDeleteNotice(new URLSearchParams(currentSearch), {
          blockedCount: result.blockedCount || invoiceBlockedCount,
        })
      : clearQuotationDeleteNotice(new URLSearchParams(currentSearch));

    updateListUrl(nextParams, hasInvoiceBlockedRows);
  }, [currentSearch, invoiceBlockedMessage, updateListUrl]);

  return (
    <CrmSelectableListTable
      rows={rows}
      columns={[
        { key: "name", label: firstColumnLabel, cellClassName: "font-medium text-slate-900", render: (row) => row.name },
        { key: "count", label: "Quotations", render: (row) => row.count },
        { key: "total", label: "Total Value", render: (row) => row.totalLabel },
        { key: "lastDate", label: "Last Activity", render: (row) => row.lastDateLabel },
      ]}
      emptyText={emptyText}
      getRowId={(row) => row.key}
      getRowLabel={(row) => row.name}
      selectionAriaLabel={`Select all ${firstColumnLabel.toLowerCase()}`}
      selectionEnabled={canDelete}
      getRowHref={(row) => row.quotationsHref}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.name}`}
            items={[
              {
                label: "View Quotations",
                href: row.quotationsHref,
              },
              ...(canDelete
                ? [
                    {
                      label: "Delete",
                      destructive: true,
                      disabled: row.quotationIds.length === 0,
                      onClick: () => void runDelete([row]),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}
      onDeleteSelected={canDelete ? runDelete : undefined}
      deleteDialogTitle={(count) => (count === 1 ? "Delete quotation?" : `Delete ${count} quotations?`)}
      deleteDialogDescription="This action will remove the selected quotation details. Please confirm to continue with deletion."
      headerDeleteEventName="crm:list-delete-selected"
      columnVisibilityStorageKey={`crm-sales-summary-list-columns-${firstColumnLabel.toLowerCase().replace(/\s+/g, "-")}`}
      columnVisibilityTitle="List Fields"
      columnVisibilityDescription={`Choose which ${firstColumnLabel.toLowerCase()} details to show.`}
    />
  );
}
