"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";
import { cn } from "@/lib/utils";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Building2,
  CalendarDays,
  Clock,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Users,
  UsersRound,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
  module?: "CRM" | "PROJECT" | "SALES";
  modulesAny?: Array<"CRM" | "PROJECT" | "SALES">;
  exactMatch?: boolean;
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  },
  {
    title: "Admin",
    href: "/admin",
    icon: <ShieldCheck className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    title: "Employees",
    href: "/employees",
    icon: <Users className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    title: "Group",
    href: "/team-management",
    icon: <UsersRound className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    title: "Employee Performance",
    href: "/employee-performance",
    icon: <TrendingUp className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
  {
    title: "Clients",
    href: "/clients",
    icon: <Building2 className="h-5 w-5" />,
    module: "CRM",
  },
  {
    title: "CRM",
    href: "/crm",
    icon: <Handshake className="h-5 w-5" />,
    module: "CRM",
    exactMatch: true,
  },
  {
    title: "Sales",
    href: "/crm/quotations",
    icon: <BadgeDollarSign className="h-5 w-5" />,
    module: "SALES",
  },
  {
    title: "Projects",
    href: "/projects",
    icon: <FolderKanban className="h-5 w-5" />,
    module: "PROJECT",
  },
  {
    title: "Work Tracking",
    href: "/work-tracking",
    icon: <Clock className="h-5 w-5" />,
  },
  {
    title: "Schedule",
    href: "/schedule",
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Activity Logs",
    href: "/activity-logs",
    icon: <Activity className="h-5 w-5" />,
    roles: ["ADMIN", "BA", "TEAMLEADER"],
  },
  {
    title: "Security",
    href: "/security",
    icon: <ShieldCheck className="h-5 w-5" />,
    roles: ["ADMIN"],
  },
];

interface SidebarProps {
  userRole: string;
  moduleAccess?: string[];
}

export function Sidebar({ userRole, moduleAccess = [] }: SidebarProps) {
  const pathname = usePathname();
  const { isSidebarOpen, closeSidebar } = useDashboardSidebar();
  const isSalesRoute =
    pathname === "/crm/quotations" ||
    pathname.startsWith("/crm/quotations/") ||
    pathname.startsWith("/sales");

  const filteredItems = navItems.filter(
    (item) =>
      (!item.roles || item.roles.includes(userRole)) &&
      (userRole === "ADMIN" ||
        ((!item.module || moduleAccess.includes(item.module)) &&
          (!item.modulesAny || item.modulesAny.some((module) => moduleAccess.includes(module)))))
  );

  useEffect(() => {
    if (!isSidebarOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeSidebar, isSidebarOpen]);

  return (
    <>
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-transparent"
          data-skip-global-loading="true"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={cn(
          "fixed left-3 top-[4.5rem] z-50 w-[min(13.75rem,calc(100vw-1.5rem))] origin-top-left overflow-hidden rounded-[var(--radius)] border border-border bg-card/95 text-foreground shadow-[var(--shadow-lg)] backdrop-blur transition-all duration-200 sm:left-4 md:left-6",
          isSidebarOpen
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0"
        )}
      >
        <nav className="space-y-1 p-2">
          {filteredItems.map((item) => {
            const isActive = item.title === "CRM"
              ? pathname.startsWith("/crm") && !isSalesRoute
              : item.title === "Sales"
                ? isSalesRoute
                : item.exactMatch
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={closeSidebar}
              className={cn(
                  "flex items-center gap-3 rounded-[calc(var(--radius)-4px)] px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-100 dark:ring-sky-900/40"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-sky-600" : "text-muted-foreground")}>{item.icon}</span>
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
