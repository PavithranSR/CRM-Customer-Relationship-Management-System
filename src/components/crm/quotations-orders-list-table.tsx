"use client";

import Link from "next/link";
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteCrmQuotations } from "@/actions/quotation.actions";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";
import { withInternalBackHref } from "@/lib/internal-navigation";
import {
  applyInvoiceFirstDeleteNotice,
  clearQuotationDeleteNotice,
} from "@/lib/quotation-delete-notice";

interface QuotationsOrdersRow {
  id: string;
  crmLeadId: string;
  quotationNo: string;
  title: string;
  projectName: string;
  clientName: string;
  salespersonName: string | null;
  status: string;
  totalLabel: string;
  createdLabel: string;
}

interface QuotationsOrdersListTableProps {
  rows: QuotationsOrdersRow[];
  emptyLabel: string;
  documentLabel?: string;
  documentLabelPlural?: string;
  numberColumnLabel?: string;
  returnHref?: string;
  canDelete?: boolean;
}

export function QuotationsOrdersListTable({
  rows,
  emptyLabel,
  documentLabel = "Quotation",
  documentLabelPlural = "Quotations",
  numberColumnLabel = "Quotation No",
  returnHref,
  canDelete = true,
}: QuotationsOrdersListTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const documentLabelLower = documentLabel.toLowerCase();
  const documentLabelPluralLower = documentLabelPlural.toLowerCase();
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

  const runDelete = useCallback(async (selectedRows: QuotationsOrdersRow[]) => {
    const ids = selectedRows.map((row) => row.id);
    if (ids.length === 0) {
      toast.error(`Select at least one ${documentLabelLower}`);
      return;
    }

    const result = await bulkDeleteCrmQuotations(ids);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    const errorList = Array.isArray(result.errors) ? result.errors.filter(Boolean) : [];
    const invoiceBlockedCount = errorList.filter((error) => error === invoiceBlockedMessage).length;
    const hasInvoiceBlockedRows = invoiceBlockedCount > 0;
    const otherErrors = errorList.filter((error) => error !== invoiceBlockedMessage);

    if ((result.deletedCount || 0) > 0) {
      toast.success(`${result.deletedCount} ${documentLabelLower}(s) deleted`);
    }

    if (otherErrors.length > 0) {
      const firstReason = otherErrors[0] ? `: ${otherErrors[0]}` : "";
      const otherErrorPrefix = hasInvoiceBlockedRows
        ? `Some ${documentLabelPluralLower} could not be deleted`
        : `${result.blockedCount || otherErrors.length} ${documentLabelLower}(s) could not be deleted`;
      toast.error(`${otherErrorPrefix}${firstReason}`);
    }

    const nextParams = hasInvoiceBlockedRows
      ? applyInvoiceFirstDeleteNotice(new URLSearchParams(currentSearch), {
          blockedCount: result.blockedCount || invoiceBlockedCount,
          blockedRef:
            selectedRows.length === 1 && (result.blockedCount || 0) === 1 && otherErrors.length === 0
              ? selectedRows[0]?.quotationNo
              : undefined,
        })
      : clearQuotationDeleteNotice(new URLSearchParams(currentSearch));

    updateListUrl(nextParams, hasInvoiceBlockedRows);
  }, [currentSearch, documentLabelLower, documentLabelPluralLower, invoiceBlockedMessage, updateListUrl]);

  return (
    <CrmSelectableListTable
      rows={rows}
      columns={[
        {
          key: "quotationNo",
          label: numberColumnLabel,
          cellClassName: "font-medium text-slate-900",
          render: (row) => (
            <Link href={withInternalBackHref(`/crm/${row.crmLeadId}/quotations/${row.id}`, returnHref)} className="hover:underline">
              {row.quotationNo}
            </Link>
          ),
        },
        { key: "title", label: "Title", render: (row) => row.title },
        { key: "projectName", label: "Project Name", render: (row) => row.projectName },
        { key: "client", label: "Client", render: (row) => row.clientName },
        { key: "salesperson", label: "Salesperson", render: (row) => row.salespersonName || "-" },
        { key: "status", label: "Status", render: (row) => row.status },
        { key: "total", label: "Total", render: (row) => row.totalLabel },
        { key: "created", label: "Created", render: (row) => row.createdLabel },
      ]}
      emptyText={`No records for ${emptyLabel}`}
      getRowId={(row) => row.id}
      getRowLabel={(row) => row.quotationNo}
      selectionAriaLabel={`Select all ${documentLabelPluralLower}`}
      selectionEnabled={canDelete}
      getRowHref={(row) => withInternalBackHref(`/crm/${row.crmLeadId}/quotations/${row.id}`, returnHref)}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.quotationNo}`}
            items={[
              { label: "Open", href: withInternalBackHref(`/crm/${row.crmLeadId}/quotations/${row.id}`, returnHref) },
              ...(canDelete ? [{ label: "Delete", destructive: true, onClick: () => void runDelete([row]) }] : []),
            ]}
          />
        </div>
      )}
      onDeleteSelected={canDelete ? runDelete : undefined}
      deleteDialogTitle={(count) => (count === 1 ? `Delete ${documentLabelLower}?` : `Delete ${count} ${documentLabelPluralLower}?`)}
      deleteDialogDescription={`This action will remove the selected ${documentLabelLower} details. Please confirm to continue with deletion.`}
      headerDeleteEventName="crm:list-delete-selected"
      columnVisibilityStorageKey={`crm-sales-list-columns-${documentLabelPluralLower.replace(/\s+/g, "-")}`}
      columnVisibilityTitle="List Fields"
      columnVisibilityDescription={`Choose which ${documentLabelPluralLower} details to show.`}
      rootClassName="flex h-full min-h-0 flex-1 flex-col gap-3 p-3"
      scrollAreaClassName="min-h-0 flex-1 overflow-auto overscroll-contain"
      stickyHeader
    />
  );
}
