"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveCrmLeadStage } from "@/actions/crm.actions";

interface CrmLeadStageStripProps {
  leadId: string;
  currentStage: string;
  stages: Array<{
    key: string;
    label: string;
  }>;
}

export function CrmLeadStageStrip({
  leadId,
  currentStage,
  stages,
}: CrmLeadStageStripProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingStage, setPendingStage] = useState<string | null>(null);
  const currentIndex = stages.findIndex((stage) => stage.key === currentStage);

  const handleStageClick = (targetStage: string, label: string) => {
    if (targetStage === currentStage) return;

    startTransition(async () => {
      setPendingStage(targetStage);
      const result = await moveCrmLeadStage(leadId, targetStage);
      if (result.error) {
        toast.error(result.error);
        setPendingStage(null);
        return;
      }

      toast.success(`Lead moved to ${label}`);
      setPendingStage(null);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center">
      {stages.map((stage, index) => {
        const current = index === currentIndex;
        const passed = currentIndex >= 0 && index < currentIndex;
        const isFirst = index === 0;
        const isLast = index === stages.length - 1;
        const clipPath = stages.length === 1
          ? "none"
          : isFirst
            ? "polygon(0 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 0 100%)"
            : isLast
              ? "polygon(15px 0, 100% 0, 100% 100%, 15px 100%, 0 50%)"
              : "polygon(15px 0, calc(100% - 15px) 0, 100% 50%, calc(100% - 15px) 100%, 15px 100%, 0 50%)";

        return (
          <div
            key={stage.key}
            className={index === 0 ? "" : "-ml-3"}
            style={{ zIndex: stages.length - index }}
          >
            <button
              type="button"
              onClick={() => handleStageClick(stage.key, stage.label)}
              disabled={isPending}
              className={`flex h-8 min-w-[88px] items-center justify-center border px-4 text-sm font-medium shadow-none transition-colors disabled:cursor-wait disabled:opacity-70 ${
                current
                  ? "border-cyan-600 bg-cyan-50 text-cyan-900"
                  : passed
                    ? "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                    : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              style={{ clipPath }}
              aria-pressed={current}
            >
              <span className="truncate">
                {isPending && pendingStage === stage.key ? "Saving..." : stage.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
