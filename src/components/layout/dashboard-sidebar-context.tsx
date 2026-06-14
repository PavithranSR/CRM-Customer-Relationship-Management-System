"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface DashboardSidebarContextValue {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const DashboardSidebarContext = createContext<DashboardSidebarContextValue | null>(null);

export function DashboardSidebarProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const value = useMemo(
    () => ({
      isSidebarOpen,
      toggleSidebar: () => setIsSidebarOpen((open) => !open),
      closeSidebar: () => setIsSidebarOpen(false),
    }),
    [isSidebarOpen]
  );

  return <DashboardSidebarContext.Provider value={value}>{children}</DashboardSidebarContext.Provider>;
}

export function useDashboardSidebar() {
  const context = useContext(DashboardSidebarContext);

  if (!context) {
    throw new Error("useDashboardSidebar must be used within DashboardSidebarProvider");
  }

  return context;
}
