"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { restoreArchivedCrmLead } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";

interface ArchivedLeadDetailActionsProps {
  leadId: string;
}

export function ArchivedLeadDetailActions({ leadId }: ArchivedLeadDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreArchivedCrmLead(leadId);
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not restore lead");
        return;
      }
      toast.success("Lead restored successfully");
      router.push("/crm/archive");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handleRestore} disabled={isPending}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {isPending ? "Processing..." : "Restore Lead"}
      </Button>
    </div>
  );
}
