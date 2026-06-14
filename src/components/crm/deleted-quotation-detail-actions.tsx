"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  permanentlyDeleteDeletedCrmQuotation,
  restoreDeletedCrmQuotation,
} from "@/actions/quotation.actions";
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
import { Button } from "@/components/ui/button";

interface DeletedQuotationDetailActionsProps {
  quotationId: string;
  canRestore: boolean;
  restoreDisabledReason?: string | null;
}

const toErrorMessage = (error: unknown, fallback: string) =>
  typeof error === "string" && error.trim().length > 0 ? error : fallback;

export function DeletedQuotationDetailActions({
  quotationId,
  canRestore,
  restoreDisabledReason,
}: DeletedQuotationDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRestore = () => {
    if (!canRestore) {
      toast.error(restoreDisabledReason || "This quotation cannot be restored");
      return;
    }

    startTransition(async () => {
      const result = await restoreDeletedCrmQuotation(quotationId);
      if ("error" in result && result.error) {
        toast.error(toErrorMessage(result.error, "Could not restore quotation"));
        return;
      }

      toast.success("Quotation restored successfully");
      router.push(`/crm/${result.crmLeadId}/quotations/${result.quotationId}`);
      router.refresh();
    });
  };

  const handlePermanentDelete = () => {
    startTransition(async () => {
      const result = await permanentlyDeleteDeletedCrmQuotation(quotationId);
      if ("error" in result && result.error) {
        toast.error(toErrorMessage(result.error, "Could not delete quotation"));
        return;
      }

      toast.success("Deleted quotation removed permanently");
      router.push("/crm/quotations?tab=quotations&deleted=1");
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleRestore} disabled={isPending || !canRestore}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {isPending ? "Processing..." : "Restore Quotation"}
        </Button>
        <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={isPending}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Permanently
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this deleted quotation permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the quotation from the deleted quotations page. You will not be able to restore it after this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete} className="bg-red-600 hover:bg-red-700">
              {isPending ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
