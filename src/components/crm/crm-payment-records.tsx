"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { updateQuotationPayment, type QuotationPaymentItem } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { withInternalBackHref } from "@/lib/internal-navigation";

interface CrmPaymentRecordsProps {
  leadId: string;
  quotationId: string;
  invoiceHref: string;
  records: QuotationPaymentItem[];
}

export function CrmPaymentRecords({ leadId, quotationId, invoiceHref, records }: CrmPaymentRecordsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hiddenRecordIds, setHiddenRecordIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPaymentType, setEditingPaymentType] = useState<"FIXED" | "PERCENTAGE" | "MONTHLY">("FIXED");
  const [editingAmount, setEditingAmount] = useState("");
  const [editingPercentage, setEditingPercentage] = useState("");
  const [editingMonths, setEditingMonths] = useState("1");
  const [editingNotes, setEditingNotes] = useState("");
  const visibleRecords = useMemo(
    () => records.filter((payment) => !hiddenRecordIds.includes(payment.id)),
    [hiddenRecordIds, records]
  );

  const startEdit = (payment: QuotationPaymentItem) => {
    setEditingId(payment.id);
    setEditingPaymentType(payment.paymentType);
    setEditingAmount(payment.amount.toFixed(2));
    setEditingPercentage(payment.percentage?.toFixed(2) || "");
    setEditingMonths(String(payment.months || 1));
    setEditingNotes(payment.notes || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingPaymentType("FIXED");
    setEditingAmount("");
    setEditingPercentage("");
    setEditingMonths("1");
    setEditingNotes("");
  };

  const editingPaidPreview = useMemo(() => {
    const amount = Number(editingAmount || 0);
    const pct = Number(editingPercentage || 0);
    const months = Number(editingMonths || 1);
    if (editingPaymentType === "PERCENTAGE") {
      return pct > 0 ? `${pct.toFixed(2)}%` : "-";
    }
    if (editingPaymentType === "MONTHLY") {
      return (amount * months).toFixed(2);
    }
    return amount.toFixed(2);
  }, [editingAmount, editingMonths, editingPaymentType, editingPercentage]);

  const saveEdit = (paymentId: string) => {
    const formData = new FormData();
    formData.set("paymentType", editingPaymentType);
    if (editingAmount) formData.set("amount", editingAmount);
    if (editingPercentage) formData.set("percentage", editingPercentage);
    if (editingMonths) formData.set("months", editingMonths);
    formData.set("notes", editingNotes);

    startTransition(async () => {
      const result = await updateQuotationPayment(paymentId, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not update payment");
        return;
      }
      toast.success("Payment updated successfully");
      cancelEdit();
      router.refresh();
    });
  };

  const hideRow = (paymentId: string) => {
    setHiddenRecordIds((prev) => (prev.includes(paymentId) ? prev : [...prev, paymentId]));
    if (editingId === paymentId) {
      cancelEdit();
    }
    toast.success("Payment hidden from this view");
  };

  if (visibleRecords.length === 0) {
    return <p className="text-sm text-slate-500">No payments added yet.</p>;
  }

  const openPaymentDetail = (paymentId: string) => {
    router.push(
      withInternalBackHref(`/crm/${leadId}/quotations/${quotationId}/invoice/payments/${paymentId}`, invoiceHref),
    );
  };

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr className="border-b text-left">
            <th className="p-3">Date</th>
            <th className="p-3">Type</th>
            <th className="p-3">Input</th>
            <th className="p-3">Paid Amount</th>
            <th className="p-3">Notes</th>
            <th className="w-[56px] p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleRecords.map((payment) => (
            <tr
              key={payment.id}
              className="border-b transition-colors hover:bg-slate-50 last:border-0"
            >
              <td
                className="cursor-pointer p-3"
                onClick={() => openPaymentDetail(payment.id)}
              >
                {new Date(payment.createdAt).toLocaleString()}
              </td>
              <td
                className="cursor-pointer p-3"
                onClick={() => openPaymentDetail(payment.id)}
              >
                {editingId === payment.id ? (
                  <select
                    value={editingPaymentType}
                    onChange={(event) =>
                      setEditingPaymentType(event.target.value as "FIXED" | "PERCENTAGE" | "MONTHLY")
                    }
                    className="h-8 rounded-md border px-2 text-sm"
                  >
                    <option value="FIXED">FIXED</option>
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="MONTHLY">MONTHLY</option>
                  </select>
                ) : (
                  payment.paymentType
                )}
              </td>
              <td
                className="cursor-pointer p-3"
                onClick={() => openPaymentDetail(payment.id)}
              >
                {editingId === payment.id ? (
                  editingPaymentType === "PERCENTAGE" ? (
                    <Input
                      value={editingPercentage}
                      onChange={(event) => setEditingPercentage(event.target.value)}
                      placeholder="Percentage"
                      className="h-8"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  ) : editingPaymentType === "MONTHLY" ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editingAmount}
                        onChange={(event) => setEditingAmount(event.target.value)}
                        placeholder="Amount"
                        className="h-8"
                        type="number"
                        min="0"
                        step="0.01"
                      />
                      <Input
                        value={editingMonths}
                        onChange={(event) => setEditingMonths(event.target.value)}
                        placeholder="Months"
                        className="h-8 w-20"
                        type="number"
                        min="1"
                        max="120"
                      />
                    </div>
                  ) : (
                    <Input
                      value={editingAmount}
                      onChange={(event) => setEditingAmount(event.target.value)}
                      placeholder="Amount"
                      className="h-8"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  )
                ) : payment.paymentType === "PERCENTAGE" ? (
                  `${payment.percentage?.toFixed(2) || "0.00"}%`
                ) : payment.paymentType === "MONTHLY" ? (
                  `${payment.amount.toFixed(2)} x ${payment.months || 1}`
                ) : (
                  payment.amount.toFixed(2)
                )}
              </td>
              <td
                className="cursor-pointer p-3 font-medium"
                onClick={() => openPaymentDetail(payment.id)}
              >
                {editingId === payment.id ? editingPaidPreview : payment.paidAmount.toFixed(2)}
              </td>
              <td
                className="cursor-pointer p-3"
                onClick={() => openPaymentDetail(payment.id)}
              >
                {editingId === payment.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingNotes}
                      onChange={(event) => setEditingNotes(event.target.value)}
                      placeholder="Notes"
                      className="h-8"
                    />
                    <Button type="button" size="sm" onClick={() => saveEdit(payment.id)} disabled={isPending}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={isPending}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  payment.notes || "-"
                )}
              </td>
              <td className="p-3 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Payment actions"
                      disabled={isPending}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => startEdit(payment)} disabled={isPending}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => hideRow(payment.id)} disabled={isPending}>
                      Hide
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
