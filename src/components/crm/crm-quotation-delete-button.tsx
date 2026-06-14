"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCrmQuotation } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";

interface CrmQuotationDeleteButtonProps {
  quotationId: string;
  crmLeadId: string;
}

export function CrmQuotationDeleteButton({ quotationId, crmLeadId }: CrmQuotationDeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteCrmQuotation(quotationId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Quotation removed");
          router.push(`/crm/${crmLeadId}/quotations`);
          router.refresh();
        })
      }
    >
      {isPending ? "Removing..." : "Remove Quotation"}
    </Button>
  );
}
