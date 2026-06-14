"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteQuotationInvoices } from "@/actions/quotation.actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { withInternalBackHref } from "@/lib/internal-navigation";

interface OrdersToInvoiceRow {
  invoiceId: string;
  quotationId: string;
  crmLeadId: string;
  invoiceRef: string;
  orderNo: string;
  clientName: string;
  salespersonName: string | null;
  status: string;
  totalLabel: string;
  createdLabel: string;
}

interface OrdersToInvoiceTableProps {
  rows: OrdersToInvoiceRow[];
  emptyLabel: string;
  selectionEnabled?: boolean;
  returnHref?: string;
  canDelete?: boolean;
}

export function OrdersToInvoiceTable({
  rows,
  emptyLabel,
  selectionEnabled = true,
  returnHref,
  canDelete = true,
}: OrdersToInvoiceTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmInvoiceId, setDeleteConfirmInvoiceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const rowIds = useMemo(() => rows.map((row) => row.invoiceId), [rows]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
  const visibleSelectedIds = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => rowIdSet.has(id))),
    [selectedIds, rowIdSet],
  );
  const allowSelection = selectionEnabled && canDelete;
  const allSelected = rowIds.length > 0 && rowIds.every((id) => visibleSelectedIds.has(id));
  const someSelected = !allSelected && rowIds.some((id) => visibleSelectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    const ids = Array.from(visibleSelectedIds);
    window.dispatchEvent(
      new CustomEvent("crm:invoice-selection-change", {
        detail: { count: visibleSelectedIds.size, ids },
      }),
    );
  }, [visibleSelectedIds]);

  useEffect(() => {
    const clearSelection = () => setSelectedIds(new Set());
    window.addEventListener("crm:invoice-selection-clear", clearSelection);
    return () => window.removeEventListener("crm:invoice-selection-clear", clearSelection);
  }, []);

  const toggleSelectAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rowIds));
  };

  const toggleRow = (invoiceId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(invoiceId);
      else next.delete(invoiceId);
      return next;
    });
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    startTransition(async () => {
      const result = await bulkDeleteQuotationInvoices([invoiceId]);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if ((result.deletedCount || 0) > 0) {
        toast.success("Invoice moved to deleted list");
      } else {
        toast.error("No invoices deleted");
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(invoiceId);
        return next;
      });
      router.refresh();
    });
  };

  return (
    <>
      <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left">
          {allowSelection ? (
            <th className="w-12 p-3">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={(event) => toggleSelectAll(event.target.checked)}
                aria-label="Select all invoices"
                className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
              />
            </th>
          ) : null}
          <th className="p-3">Invoice ID</th>
          <th className="p-3">Order No</th>
          <th className="p-3">Client Name</th>
          <th className="p-3">Salesperson</th>
          <th className="p-3">Status</th>
          <th className="p-3">Total</th>
          <th className="p-3">Created</th>
          <th className="w-14 p-3 text-right" />
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={allowSelection ? 9 : 8} className="p-8 text-center text-slate-500">
              No records for {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((invoiceRow) => (
            <tr key={invoiceRow.invoiceId} className="border-b hover:bg-slate-50">
              {allowSelection ? (
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={visibleSelectedIds.has(invoiceRow.invoiceId)}
                    onChange={(event) => toggleRow(invoiceRow.invoiceId, event.target.checked)}
                    aria-label={`Select ${invoiceRow.invoiceRef}`}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                  />
                </td>
              ) : null}
              <td className="p-3">
                <Link
                  href={withInternalBackHref(
                    `/crm/${invoiceRow.crmLeadId}/quotations/${invoiceRow.quotationId}/invoice`,
                    returnHref,
                  )}
                  className="font-medium hover:underline"
                >
                  {invoiceRow.invoiceRef}
                </Link>
              </td>
              <td className="p-3">
                <Link
                  href={withInternalBackHref(
                    `/crm/${invoiceRow.crmLeadId}/quotations/${invoiceRow.quotationId}`,
                    returnHref,
                  )}
                  className="hover:underline"
                >
                  {invoiceRow.orderNo}
                </Link>
              </td>
              <td className="p-3">{invoiceRow.clientName}</td>
              <td className="p-3">{invoiceRow.salespersonName || "-"}</td>
              <td className="p-3">{invoiceRow.status}</td>
              <td className="p-3">{invoiceRow.totalLabel}</td>
              <td className="p-3">{invoiceRow.createdLabel}</td>
              <td className="p-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={isPending}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Actions for ${invoiceRow.invoiceRef}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem asChild>
                        <Link
                          href={withInternalBackHref(
                            `/crm/${invoiceRow.crmLeadId}/quotations/${invoiceRow.quotationId}/invoice`,
                            returnHref,
                          )}
                        >
                          Open Invoice
                        </Link>
                      </DropdownMenuItem>
                      {canDelete ? (
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700"
                          onClick={() => setDeleteConfirmInvoiceId(invoiceRow.invoiceId)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
            </tr>
          ))
        )}
      </tbody>
      </table>
      <AlertDialog open={!!deleteConfirmInvoiceId} onOpenChange={(open) => !open && setDeleteConfirmInvoiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will move the selected invoice to the deleted list.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmInvoiceId) handleDeleteInvoice(deleteConfirmInvoiceId);
                setDeleteConfirmInvoiceId(null);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
