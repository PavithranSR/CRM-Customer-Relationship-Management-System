"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function DashboardMainShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCrmPipelineRoute = pathname === "/crm";
  const isClientsRoute = pathname === "/clients";
  const isEmployeesRoute = pathname === "/employees";
  const isWorkTrackingRoute = pathname === "/work-tracking";
  const isSalesQuotationsRoute =
    pathname === "/crm/quotations" && searchParams.get("embedded") !== "crm";
  const usesInnerPageScroll =
    isCrmPipelineRoute ||
    isClientsRoute ||
    isEmployeesRoute ||
    isWorkTrackingRoute ||
    isSalesQuotationsRoute;

  return (
    <main
      className={cn(
        "min-h-0 flex-1 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5",
        usesInnerPageScroll ? "overflow-hidden" : "overflow-y-auto"
      )}
    >
      <div className={cn("dashboard-page-shell", usesInnerPageScroll && "h-full pb-0 sm:pb-0")}>
        {children}
      </div>
    </main>
  );
}
