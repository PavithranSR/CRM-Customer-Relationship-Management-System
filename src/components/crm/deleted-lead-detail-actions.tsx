"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { restoreDeletedCrmLead, permanentlyDeleteCrmLead } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";

interface DeletedLeadDetailActionsProps {
  leadId: string;
}

export function DeletedLeadDetailActions({ leadId }: DeletedLeadDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRestore = () => {
    startTransition(async () => {
      const result = await restoreDeletedCrmLead(leadId);
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not restore lead");
        return;
      }
      toast.success("Lead restored successfully");
      router.push("/crm/deleted");
      router.refresh();
    });
  };

  const handlePermanentDelete = () => {
    startTransition(async () => {
      const result = await permanentlyDeleteCrmLead(leadId);
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not delete lead");
        return;
      }
      toast.success("Lead deleted permanently");
      router.push("/crm/deleted");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" onClick={handleRestore} disabled={isPending}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {isPending ? "Processing..." : "Restore Lead"}
      </Button>
      <Button type="button" variant="destructive" onClick={handlePermanentDelete} disabled={isPending}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Permanently
      </Button>
    </div>
  );
}
