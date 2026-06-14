"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendCrmQuotation } from "@/actions/quotation.actions";
import { CrmInvoiceExportButton } from "@/components/crm/crm-invoice-export-button";
import { Button } from "@/components/ui/button";
import { withInternalBackHref } from "@/lib/internal-navigation";

interface CrmInvoiceToolbarProps {
  leadId: string;
  quotationId: string;
  invoiceHref: string;
  canCreateInvoice: boolean;
  invoiceNumber: string;
  quotationNo: string;
  invoiceDate: string;
  dueDate: string | null;
  paymentType: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectTitle: string;
  productName: string;
  unitLabel: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  subtotalAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
}

export function CrmInvoiceToolbar({
  leadId,
  quotationId,
  invoiceHref,
  canCreateInvoice,
  invoiceNumber,
  quotationNo,
  invoiceDate,
  dueDate,
  paymentType,
  clientName,
  clientEmail,
  clientPhone,
  projectTitle,
  productName,
  unitLabel,
  quantity,
  unitPrice,
  gstPercent,
  subtotalAmount,
  totalAmount,
  paidAmount,
  balanceAmount,
}: CrmInvoiceToolbarProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSendAndPrint = () => {
    startTransition(async () => {
      const result = await sendCrmQuotation(quotationId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.mailSent) {
        toast.success(result.message || "Quotation sent");
      } else {
        toast.warning(result.message || "Marked sent, but email not delivered.");
      }
      window.print();
    });
  };

  const handleRegisterPayment = () => {
    router.push(withInternalBackHref(`/crm/${leadId}/quotations/${quotationId}/invoice/create`, invoiceHref));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={handleRegisterPayment}
        disabled={!canCreateInvoice}
        className="bg-[#7c4a69] text-white shadow-sm hover:bg-[#6d425d] focus-visible:ring-2 focus-visible:ring-[#7c4a69] focus-visible:ring-offset-2"
      >
        {canCreateInvoice ? "Create Invoice" : "Confirm Quotation First"}
      </Button>
      <Button onClick={handleSendAndPrint} disabled={isPending} variant="secondary">
        {isPending ? "Sending..." : "Send & Print"}
      </Button>
      <CrmInvoiceExportButton
        invoiceNumber={invoiceNumber}
        quotationNo={quotationNo}
        invoiceDate={invoiceDate}
        dueDate={dueDate}
        paymentType={paymentType}
        clientName={clientName}
        clientEmail={clientEmail}
        clientPhone={clientPhone}
        projectTitle={projectTitle}
        productName={productName}
        unitLabel={unitLabel}
        quantity={quantity}
        unitPrice={unitPrice}
        gstPercent={gstPercent}
        subtotalAmount={subtotalAmount}
        totalAmount={totalAmount}
        paidAmount={paidAmount}
        balanceAmount={balanceAmount}
      />
    </div>
  );
}
