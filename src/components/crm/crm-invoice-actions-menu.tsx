"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import { deleteQuotationInvoice } from "@/actions/quotation.actions";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CrmInvoiceActionsMenuProps {
  quotationId: string;
  align?: "start" | "center" | "end";
}

export function CrmInvoiceActionsMenu({ quotationId, align = "end" }: CrmInvoiceActionsMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteQuotationInvoice(quotationId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invoice moved to deleted list");
      router.push("/crm/quotations?tab=to-invoice&deleted=1");
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Invoice settings"
            disabled={isPending}
            className="h-9 w-9 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setConfirmDelete(true);
            }}
            className="text-red-600 focus:text-red-600"
          >
            Delete Invoice
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will move the invoice to the deleted invoices list. You can review it from the deleted view.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
