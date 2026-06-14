"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveCrmLeadStage } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";

interface CrmLeadQuickActionsProps {
  leadId: string;
  currentStage: string;
  wonStageKey: string | null;
  lostStageKey: string | null;
  enrichHref: string;
  isEnriching?: boolean;
  showEnrich?: boolean;
}

export function CrmLeadQuickActions({
  leadId,
  currentStage,
  wonStageKey,
  lostStageKey,
  enrichHref,
  isEnriching = false,
  showEnrich = true,
}: CrmLeadQuickActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"Won" | "Lost" | null>(null);

  const handleStageChange = (targetStage: string | null, label: "Won" | "Lost") => {
    if (!targetStage) {
      toast.error(`${label} stage is not configured in CRM stages.`);
      return;
    }

    if (currentStage === targetStage) {
      toast.success(`Lead is already marked as ${label.toLowerCase()}.`);
      return;
    }

    startTransition(async () => {
      setPendingAction(label);
      const result = await moveCrmLeadStage(leadId, targetStage);
      if (result.error) {
        toast.error(result.error);
        setPendingAction(null);
        return;
      }

      toast.success(`Lead moved to ${label.toLowerCase()} stage`);
      setPendingAction(null);
      router.refresh();
    });
  };

  const isWonActive = !!wonStageKey && currentStage === wonStageKey;
  const isLostActive = !!lostStageKey && currentStage === lostStageKey;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        type="button"
        onClick={() => handleStageChange(wonStageKey, "Won")}
        disabled={isPending}
        className={isWonActive
          ? "h-8 rounded-sm bg-[#7c4a69] px-3.5 shadow-none hover:bg-[#6d425d]"
          : "h-8 rounded-sm px-3.5 shadow-none"}
        variant={isWonActive ? "default" : "secondary"}
      >
        {isPending && pendingAction === "Won" ? "Saving..." : "Won"}
      </Button>
      {showEnrich ? (
        <Button
          asChild
          size="sm"
          variant={isEnriching ? "default" : "secondary"}
          className={isEnriching ? "bg-[#44a2de] hover:bg-[#3991ca]" : ""}
        >
          <Link href={enrichHref}>Enrich</Link>
        </Button>
      ) : null}
      <Button
        size="sm"
        type="button"
        onClick={() => handleStageChange(lostStageKey, "Lost")}
        disabled={isPending}
        className="h-8 rounded-sm px-3.5 shadow-none"
        variant={isLostActive ? "destructive" : "secondary"}
      >
        {isPending && pendingAction === "Lost" ? "Saving..." : "Lost"}
      </Button>
    </div>
  );
}
