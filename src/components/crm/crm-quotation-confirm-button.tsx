"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmCrmQuotation } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";

interface CrmQuotationConfirmButtonProps {
  quotationId: string;
  crmLeadId: string;
  quotationHref?: string;
}

export function CrmQuotationConfirmButton({
  quotationId,
  crmLeadId,
  quotationHref,
}: CrmQuotationConfirmButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await confirmCrmQuotation(quotationId);
      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not confirm quotation");
        return;
      }
      toast.success("Quotation confirmed");
      router.refresh();
      router.push(quotationHref || `/crm/${crmLeadId}/quotations/${quotationId}`);
    });
  };

  return (
    <Button onClick={handleConfirm} disabled={isPending}>
      {isPending ? "Confirming..." : "Confirm"}
    </Button>
  );
}
