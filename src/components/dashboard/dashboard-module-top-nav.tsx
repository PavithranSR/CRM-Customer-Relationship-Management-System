"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

type DashboardPanelKey = "projects" | "sales" | "invoicing" | "expenses";

interface DashboardModuleTopNavProps {
  role: string;
  moduleAccess?: string[];
}

const PANEL_LABELS: Record<DashboardPanelKey, string> = {
  projects: "Projects",
  sales: "Sales",
  invoicing: "Invoicing",
  expenses: "Expenses",
};
const PROJECT_DASHBOARD_PANELS: DashboardPanelKey[] = ["projects"];
const SALES_DASHBOARD_PANELS: DashboardPanelKey[] = ["sales", "invoicing", "expenses"];

export function DashboardModuleTopNav({
  role,
  moduleAccess = [],
}: DashboardModuleTopNavProps) {
  const searchParams = useSearchParams();
  const isAdmin = role === "ADMIN";
  const hasProjectAccess = isAdmin || moduleAccess.includes("PROJECT");
  const hasSalesAccess = isAdmin || moduleAccess.includes("SALES");
  const allowedPanels: DashboardPanelKey[] = [
    ...(hasProjectAccess ? PROJECT_DASHBOARD_PANELS : []),
    ...(hasSalesAccess ? SALES_DASHBOARD_PANELS : []),
  ];

  const requestedPanel = (searchParams.get("panel") || "").toLowerCase();
  const currentPanel =
    allowedPanels.find((panel) => panel === requestedPanel) ??
    allowedPanels[0] ??
    null;
  const buildPanelHref = (panel: DashboardPanelKey) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("panel", panel);
    return `/dashboard?${nextParams.toString()}`;
  };

  return (
    <div className="flex min-w-0 items-center">
      {allowedPanels.length > 0 ? (
        <div className="min-w-0 overflow-x-auto">
          <div className="inline-flex min-w-max items-center gap-2">
            {allowedPanels.map((panel) => {
              const isActive = currentPanel === panel;

              return (
                <Link
                  key={panel}
                  href={buildPanelHref(panel)}
                  className={cn(
                    "px-2 py-1 text-base font-semibold transition-colors duration-200",
                    isActive
                      ? "text-[#44a2de]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {PANEL_LABELS[panel]}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
