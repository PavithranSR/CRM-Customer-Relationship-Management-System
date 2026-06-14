"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isCrmSalesFilterKey, type CrmSalesFilterKey } from "@/components/crm/crm-module-top-nav";
import { CrmPipeline } from "@/components/crm/crm-pipeline";
import { useLoadingPulse } from "@/components/crm/use-loading-pulse";
import type { CrmLeadItem, CrmStageItem } from "@/actions/crm.actions";

interface CrmPipelineViewProps {
  leads: CrmLeadItem[];
  stages: CrmStageItem[];
  query: string;
  salesperson: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  clients: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }[];
}

const subscribeToHydration = () => () => {};
const PIPELINE_VIEW_HEIGHT_CLASS =
  "h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6rem)] md:h-[calc(100dvh-6.5rem)]";
const PIPELINE_VIEW_BOTTOM_OFFSET_CLASS = "-mb-4 sm:-mb-5";

function CrmPipelineViewSkeleton() {
  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-2 overflow-hidden ${PIPELINE_VIEW_HEIGHT_CLASS} ${PIPELINE_VIEW_BOTTOM_OFFSET_CLASS}`}
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
          <div className="h-[76px] shrink-0 rounded-xl border bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/90" />
          <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)]" />
        </div>
      </div>
    </div>
  );
}

export function CrmPipelineView({ leads, stages, query, salesperson, clients }: CrmPipelineViewProps) {
  const hasMounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isActive: isSalesFilterLoading, run: runWithSalesFilterLoading } = useLoadingPulse();
  const salesFilterParam = searchParams.get("sales");
  const salesFilter: CrmSalesFilterKey = isCrmSalesFilterKey(salesFilterParam) ? salesFilterParam : "all";

  const handleSalesFilterChange = (value: CrmSalesFilterKey) => {
    if (value === salesFilter) {
      return;
    }

    runWithSalesFilterLoading(() => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (value === "all") {
        nextParams.delete("sales");
      } else {
        nextParams.set("sales", value);
      }

      const nextQueryString = nextParams.toString();
      router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false });
    });
  };

  if (!hasMounted) {
    return <CrmPipelineViewSkeleton />;
  }

  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-2 overflow-hidden ${PIPELINE_VIEW_HEIGHT_CLASS} ${PIPELINE_VIEW_BOTTOM_OFFSET_CLASS}`}
    >
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <CrmPipeline
          leads={leads}
          stages={stages}
          query={query}
          salesperson={salesperson}
          clients={clients}
          salesFilter={salesFilter}
          onSalesFilterChange={handleSalesFilterChange}
          externalBusy={isSalesFilterLoading}
        />
      </div>
    </div>
  );
}
