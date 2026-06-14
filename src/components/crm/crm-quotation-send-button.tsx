"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { sendCrmQuotation } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";

interface CrmQuotationSendButtonProps {
  quotationId: string;
  isResend?: boolean;
}

export function CrmQuotationSendButton({ quotationId, isResend = false }: CrmQuotationSendButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await sendCrmQuotation(quotationId);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (result.mailSent) {
            toast.success(result.message || "Quotation PDF sent to client");
          } else {
            toast.warning(result.message || "Could not send quotation PDF email.");
          }
          router.refresh();
        })
      }
    >
      {isPending ? "Sending..." : isResend ? "Resend PDF to Client" : "Send PDF to Client"}
    </Button>
  );
}
