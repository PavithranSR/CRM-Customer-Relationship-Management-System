"use client";

import { CrmPipelineContent } from "@/components/crm/pipeline/crm-pipeline-content";
import { CrmPipelineDialogs } from "@/components/crm/pipeline/crm-pipeline-dialogs";
import { CrmPipelineToolbar } from "@/components/crm/pipeline/crm-pipeline-toolbar";
import type { CrmPipelineProps } from "@/components/crm/pipeline/crm-pipeline-types";
import { useCrmPipelineController } from "@/components/crm/pipeline/use-crm-pipeline-controller";

interface CrmPipelineComponentProps extends CrmPipelineProps {
  externalBusy?: boolean;
}

export function CrmPipeline({ externalBusy = false, ...props }: CrmPipelineComponentProps) {
  const { toolbarProps, contentProps, dialogProps, isBusy } = useCrmPipelineController(props);

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden"
      aria-busy={isBusy || externalBusy}
    >
      <CrmPipelineToolbar {...toolbarProps} />
      <CrmPipelineContent {...contentProps} />
      <CrmPipelineDialogs {...dialogProps} />
    </div>
  );
}
