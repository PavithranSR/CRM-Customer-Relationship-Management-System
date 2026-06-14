"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { bulkDeleteQuotationInvoices } from "@/actions/quotation.actions";
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

interface OrdersToInvoiceSelectionToolbarProps {
  isToInvoiceTab: boolean;
  children: ReactNode;
}

export function OrdersToInvoiceSelectionToolbar({ isToInvoiceTab, children }: OrdersToInvoiceSelectionToolbarProps) {
  const [selectedCount, setSelectedCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onSelectionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number; ids?: string[] }>;
      setSelectedCount(Number(customEvent.detail?.count || 0));
      setSelectedIds(Array.isArray(customEvent.detail?.ids) ? customEvent.detail.ids : []);
    };
    window.addEventListener("crm:invoice-selection-change", onSelectionChange as EventListener);
    return () => window.removeEventListener("crm:invoice-selection-change", onSelectionChange as EventListener);
  }, []);

  if (!isToInvoiceTab || selectedCount <= 0) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex h-auto w-full max-w-[420px] flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 sm:h-9 sm:flex-nowrap sm:py-0">
        <p className="text-sm font-medium text-red-700">{selectedCount} selected</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            aria-label="Delete selected invoices"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPending ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("crm:invoice-selection-clear"))}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-700 hover:bg-red-100"
            aria-label="Clear selected invoices"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected invoices?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will move the selected invoices to the deleted list.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const result = await bulkDeleteQuotationInvoices(selectedIds);
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  if ((result.deletedCount || 0) > 0) {
                    toast.success(`${result.deletedCount} invoice(s) moved to deleted list`);
                  } else {
                    toast.error("No invoices deleted");
                  }
                  setShowDeleteConfirm(false);
                  window.dispatchEvent(new Event("crm:invoice-selection-clear"));
                  router.refresh();
                })
              }
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
