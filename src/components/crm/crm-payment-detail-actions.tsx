"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteQuotationPayment, updateQuotationPayment } from "@/actions/quotation.actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CrmPaymentDetailActionsProps {
  canDelete: boolean;
  canEdit: boolean;
  backHref: string;
  paymentId: string;
  leadId: string;
  quotationId: string;
  quotationNo: string;
  paymentType: string;
  amount: number;
  percentage: number | null;
  months: number | null;
  notesText: string;
  paidAmountLabel: string;
  recordedAtLabel: string;
  customerName: string;
  projectTitle: string;
  notes: Array<{ label: string; value: string }>;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function CrmPaymentDetailActions(props: CrmPaymentDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [editingPaymentType, setEditingPaymentType] = useState<"FIXED" | "PERCENTAGE" | "MONTHLY">(
    props.paymentType as "FIXED" | "PERCENTAGE" | "MONTHLY"
  );
  const [editingAmount, setEditingAmount] = useState(props.amount ? props.amount.toFixed(2) : "");
  const [editingPercentage, setEditingPercentage] = useState(
    props.percentage !== null && props.percentage !== undefined ? props.percentage.toFixed(2) : ""
  );
  const [editingMonths, setEditingMonths] = useState(String(props.months || 1));
  const [editingNotes, setEditingNotes] = useState(props.notesText || "");

  const handleExport = () => {
    const notesMarkup =
      props.notes.length === 0
        ? "<p>No additional notes</p>"
        : props.notes
            .map(
              (item) => `
                <div class="note-row">
                  <span>${escapeHtml(item.label)}</span>
                  <strong>${escapeHtml(item.value)}</strong>
                </div>
              `
            )
            .join("");

    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment ${escapeHtml(props.paymentId)}</title>
    <style>
      body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 24px; }
      h1 { margin: 0 0 6px; font-size: 28px; }
      .sub { color: #64748b; margin: 0 0 18px; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
      .label { color: #64748b; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; }
      .value { font-size: 22px; font-weight: 700; }
      .section { margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; }
      .row, .note-row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
      .row:last-child, .note-row:last-child { border-bottom: 0; }
      .row span:first-child, .note-row span:first-child { color: #64748b; }
      @media print { body { margin: 12mm; } }
    </style>
  </head>
  <body>
    <h1>Payment Detail</h1>
    <p class="sub">${escapeHtml(props.quotationNo)} - ${escapeHtml(props.customerName)}</p>
    <div class="grid">
      <div class="card">
        <div class="label">Paid Amount</div>
        <div class="value">${escapeHtml(props.paidAmountLabel)}</div>
      </div>
      <div class="card">
        <div class="label">Payment Type</div>
        <div class="value">${escapeHtml(props.paymentType)}</div>
      </div>
    </div>
    <div class="section">
      <div class="row"><span>Quotation No</span><strong>${escapeHtml(props.quotationNo)}</strong></div>
      <div class="row"><span>Customer</span><strong>${escapeHtml(props.customerName)}</strong></div>
      <div class="row"><span>Project</span><strong>${escapeHtml(props.projectTitle)}</strong></div>
      <div class="row"><span>Recorded On</span><strong>${escapeHtml(props.recordedAtLabel)}</strong></div>
    </div>
    <div class="section">
      <h2 style="margin-top:0;">Payment Notes</h2>
      ${notesMarkup}
    </div>
  </body>
</html>`;

    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);
    frame.onload = () => {
      frame.contentWindow?.document.open();
      frame.contentWindow?.document.write(html);
      frame.contentWindow?.document.close();
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(frame)) {
          document.body.removeChild(frame);
        }
      }, 1000);
    };
    frame.src = "about:blank";
    toast.success("Payment detail export opened");
  };

  const handleDelete = () => {
    if (!props.canDelete) {
      toast.error("Only employees with delete permission can remove payment records.");
      return;
    }
    setDeleteReason("");
    setConfirmDelete(true);
  };

  const handleEdit = () => {
    if (!props.canEdit) {
      toast.error("Only employees with update permission can edit payment records.");
      return;
    }
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("paymentType", editingPaymentType);
      if (editingAmount) formData.set("amount", editingAmount);
      if (editingPercentage) formData.set("percentage", editingPercentage);
      if (editingMonths) formData.set("months", editingMonths);
      formData.set("notes", editingNotes);

      const result = await updateQuotationPayment(props.paymentId, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not update payment");
        return;
      }

      toast.success("Payment updated successfully");
      setEditOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Open payment actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={handleEdit} disabled={isPending}>
            Edit Payment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport} disabled={isPending}>
            Export Detail
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            disabled={isPending}
            className="text-red-600 focus:text-red-700"
          >
            {isPending ? "Deleting..." : "Delete Payment"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>Update the payment record directly from this detail page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Payment Type</Label>
              <Select value={editingPaymentType} onValueChange={(value) => setEditingPaymentType(value as "FIXED" | "PERCENTAGE" | "MONTHLY")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Fixed Payment</SelectItem>
                  <SelectItem value="PERCENTAGE">Percentage Payment</SelectItem>
                  <SelectItem value="MONTHLY">Monthly Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editingPaymentType === "PERCENTAGE" ? (
              <div className="space-y-2">
                <Label>Percentage (%)</Label>
                <Input type="number" min="0" max="100" step="0.01" value={editingPercentage} onChange={(event) => setEditingPercentage(event.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{editingPaymentType === "MONTHLY" ? "Monthly Amount" : "Payment Amount"}</Label>
                <Input type="number" min="0" step="0.01" value={editingAmount} onChange={(event) => setEditingAmount(event.target.value)} />
              </div>
            )}

            {editingPaymentType === "MONTHLY" ? (
              <div className="space-y-2">
                <Label>Months</Label>
                <Input type="number" min="1" max="120" value={editingMonths} onChange={(event) => setEditingMonths(event.target.value)} />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={4} value={editingNotes} onChange={(event) => setEditingNotes(event.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              Enter the reason for deleting this payment entry. This reason will be saved in the activity log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-payment-reason">Delete reason</Label>
            <Textarea
              id="delete-payment-reason"
              rows={4}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              placeholder="Enter the reason for deleting this payment"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePayment}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending || !deleteReason.trim()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  function confirmDeletePayment() {
    startTransition(async () => {
      const result = await deleteQuotationPayment(props.paymentId, deleteReason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment record removed");
      router.push(props.backHref);
      router.refresh();
    });
  }
}
