"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertQuotationInvoice } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CrmInvoiceFormProps {
  quotationId: string;
  quoteTotal: number;
  currentPaid: number;
  currentBalance: number;
}

export function CrmInvoiceForm({
  quotationId,
  quoteTotal,
  currentPaid,
  currentBalance,
}: CrmInvoiceFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const submitLockRef = useRef(false);

  const [paymentType, setPaymentType] = useState<"FIXED" | "PERCENTAGE" | "MONTHLY">("FIXED");
  const [amount, setAmount] = useState("");
  const [percentage, setPercentage] = useState("");
  const [months, setMonths] = useState("1");
  const [notes, setNotes] = useState("");
  const paymentTerms = "Due on receipt";
  const bankDetails = "";

  const normalizedQuoteTotal = Number(quoteTotal || 0);
  const balanceBeforeSave = Number(currentBalance || 0);
  const amountInputId = paymentType === "PERCENTAGE" ? "crm-invoice-percentage" : "crm-invoice-amount";

  useEffect(() => {
    const input = document.getElementById(amountInputId);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    }
  }, [amountInputId]);

  const calc = useMemo(() => {
    const fixedAmount = Number(amount || 0);
    const pct = Number(percentage || 0);
    const monthsCount = Number(months || 1);

    if (paymentType === "PERCENTAGE") {
      const calculatedAmount = (normalizedQuoteTotal * pct) / 100;
      return {
        payableAmount: calculatedAmount,
        balance: Math.max(balanceBeforeSave - calculatedAmount, 0),
      };
    }

    if (paymentType === "MONTHLY") {
      const scheduled = fixedAmount * monthsCount;
      return {
        payableAmount: scheduled,
        balance: Math.max(balanceBeforeSave - scheduled, 0),
      };
    }

    return {
      payableAmount: fixedAmount,
      balance: Math.max(balanceBeforeSave - fixedAmount, 0),
    };
  }, [amount, balanceBeforeSave, months, normalizedQuoteTotal, paymentType, percentage]);

  const paymentFieldLabel =
    paymentType === "PERCENTAGE"
      ? "Percentage to Collect"
      : paymentType === "MONTHLY"
        ? "Monthly Amount"
        : "Amount Received";
  const paymentFieldHint =
    paymentType === "PERCENTAGE"
      ? "Enter the percentage of the total invoice you want to collect now."
      : paymentType === "MONTHLY"
        ? "Enter the amount that should be collected every month."
        : "Enter the exact payment received from the customer.";
  const paymentFieldSupport =
    paymentType === "PERCENTAGE"
      ? "The payment amount will be calculated automatically."
      : "This is the main field users should complete first.";

  const handlePaymentTypeChange = (value: "FIXED" | "PERCENTAGE" | "MONTHLY") => {
    setPaymentType(value);
    if (value === "PERCENTAGE") {
      setAmount("");
      setPercentage("");
    } else {
      setPercentage("");
    }
  };

  const fillFixedAmount = (value: number) => {
    setAmount(value > 0 ? value.toFixed(2) : "");
  };

  const handleSubmit = () => {
    if (submitLockRef.current) {
      return;
    }

    const formData = new FormData();
    formData.set("paymentType", paymentType);
    if (amount) formData.set("amount", amount);
    if (percentage) formData.set("percentage", percentage);
    if (months) formData.set("months", months);
    const enrichedNotes = [
      notes.trim(),
      paymentTerms ? `Payment Terms: ${paymentTerms}` : "",
      bankDetails ? `Bank Details: ${bankDetails}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (enrichedNotes) formData.set("notes", enrichedNotes);

    submitLockRef.current = true;
    setIsSaving(true);
    void (async () => {
      const result = await upsertQuotationInvoice(quotationId, formData);
      if (result.error) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().filter(Boolean).join(", ");
        toast.error(msg || "Could not save invoice");
        return;
      }

      toast.success("Invoice saved");
      setAmount("");
      setPercentage("");
      setMonths("1");
      setNotes("");
      router.refresh();
    })()
      .catch(() => {
        toast.error("Could not save invoice");
      })
      .finally(() => {
        submitLockRef.current = false;
        setIsSaving(false);
      });
  };

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <div className="space-y-1">
          <Label className="text-base font-semibold">Payment Type</Label>
          <p className="text-sm text-slate-600">Choose the payment method first.</p>
        </div>
        <Select value={paymentType} onValueChange={(value) => handlePaymentTypeChange(value as "FIXED" | "PERCENTAGE" | "MONTHLY")}>
          <SelectTrigger className="h-12 max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXED">Fixed Payment</SelectItem>
            <SelectItem value="PERCENTAGE">Percentage Payment</SelectItem>
            <SelectItem value="MONTHLY">Monthly Payment</SelectItem>
          </SelectContent>
        </Select>

        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Label className="text-lg font-semibold text-slate-900">{paymentFieldLabel}</Label>
              <p className="text-sm text-slate-600">{paymentFieldHint}</p>
            </div>
            <div className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white">
              Main entry field
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {paymentType === "PERCENTAGE" ? (
              <div className="space-y-2">
                <Label htmlFor={amountInputId} className="text-sm font-semibold text-slate-900">
                  Percentage (%)
                </Label>
                <Input
                  id={amountInputId}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="Enter percentage"
                  value={percentage}
                  onChange={(event) => setPercentage(event.target.value)}
                  className="h-14 text-xl font-semibold"
                />
                <p className="text-sm text-slate-600">Example: 25 means collect 25% of the invoice.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={amountInputId} className="text-sm font-semibold text-slate-900">
                    {paymentFieldLabel}
                  </Label>
                  <Input
                    id={amountInputId}
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="h-14 text-xl font-semibold"
                  />
                  <p className="text-sm text-slate-600">{paymentFieldSupport}</p>
                </div>

                {paymentType === "MONTHLY" && (
                  <div className="space-y-2">
                    <Label htmlFor="crm-invoice-months" className="text-sm font-semibold text-slate-900">
                      Months
                    </Label>
                    <Input
                      id="crm-invoice-months"
                      type="number"
                      min="1"
                      max="120"
                      placeholder="1"
                      value={months}
                      onChange={(event) => setMonths(event.target.value)}
                      className="h-12 max-w-xs text-lg font-semibold"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {paymentType === "FIXED" && (
                <>
                  <Button type="button" variant="outline" onClick={() => fillFixedAmount(balanceBeforeSave)}>
                    Full balance
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fillFixedAmount(balanceBeforeSave / 2)}>
                    Half balance
                  </Button>
                </>
              )}
              {paymentType === "MONTHLY" && (
                <Button type="button" variant="outline" onClick={() => fillFixedAmount(balanceBeforeSave)}>
                  Use balance
                </Button>
              )}
              {paymentType === "PERCENTAGE" && (
                <>
                  <Button type="button" variant="outline" onClick={() => setPercentage("25")}>
                    25%
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPercentage("50")}>
                    50%
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPercentage("100")}>
                    100%
                  </Button>
                </>
              )}
              {(paymentType === "FIXED" || paymentType === "MONTHLY") && (
                <Button type="button" variant="ghost" onClick={() => setAmount("")}>
                  Clear
                </Button>
              )}
            {paymentType === "PERCENTAGE" && (
              <Button type="button" variant="ghost" onClick={() => setPercentage("")}>
                Clear
              </Button>
            )}
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-[#7c4a69] text-white hover:bg-[#6d425d]"
              >
                {isSaving ? "Saving..." : "Add Payment"}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Amount</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{normalizedQuoteTotal.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid Amount</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{currentPaid.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Current Amount
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{calc.payableAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balance Amount</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{calc.balance.toFixed(2)}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
