"use client";

import Link from "next/link";
import { logout } from "@/actions/auth.actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AdminMessageComposer } from "@/components/layout/admin-message-composer";
import { RoleHelpDialog } from "@/components/layout/role-help-dialog";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useDashboardSidebar } from "@/components/layout/dashboard-sidebar-context";
import { ProjectsModuleHeader } from "@/components/projects/projects-module-header";
import { ClientsModuleTopNav } from "@/components/clients/clients-module-top-nav";
import { CrmModuleTopNav } from "@/components/crm/crm-module-top-nav";
import { SalesQuotationsModuleTopNav } from "@/components/crm/sales-quotations-module-top-nav";
import { DashboardModuleTopNav } from "@/components/dashboard/dashboard-module-top-nav";
import { LogOut, Menu, Settings, User } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface HeaderProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    moduleAccess?: string[];
    role: string;
  };
}

const subscribeToHydration = () => () => {};

function HeaderActionsSkeleton({ showComposer }: { showComposer: boolean }) {
  return (
    <>
      {showComposer ? (
        <div
          aria-hidden="true"
          className="h-9 w-9 rounded-full border border-border bg-muted"
        />
      ) : null}
      <div
        aria-hidden="true"
        className="h-9 w-9 rounded-full border border-border bg-muted"
      />
      <div
        aria-hidden="true"
        className="h-9 w-9 rounded-full border border-border bg-muted"
      />
      <div
        aria-hidden="true"
        className="h-9 w-9 rounded-full border border-border bg-muted"
      />
      <div aria-hidden="true" className="flex flex-col items-center gap-1">
        <div className="h-9 w-9 rounded-full border border-border bg-muted sm:h-10 sm:w-10" />
        <div className="h-2 w-10 rounded-full bg-muted" />
      </div>
    </>
  );
}
export function Header({ user }: HeaderProps) {
  const [isPending, startTransition] = useTransition();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const hasMounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isSidebarOpen, toggleSidebar } = useDashboardSidebar();
  const pathSegments = pathname.split("/").filter(Boolean);

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  const roleLabel =
    user.role === "TEAMLEADER"
      ? "TL"
      : user.role === "ADMIN"
        ? "ADMIN"
        : user.role === "BA"
          ? "BA"
          : "EMPLOYEE";

  const isCrmRoute = pathname.startsWith("/crm");
  const isProjectsRoute = pathname.startsWith("/projects");
  const isAdminRoute = pathname === "/admin";
  const isProjectsIndexRoute = pathname === "/projects";
  const projectPathParts = pathname.split("/").filter(Boolean);
  const projectId =
    projectPathParts[0] === "projects" &&
    projectPathParts[1] &&
    projectPathParts[1] !== "new"
      ? projectPathParts[1]
      : null;
  const projectView = searchParams.get("view");
  const isProjectEditRoute = pathname.endsWith("/edit");
  const isProjectDetailsRoute =
    pathname === "/projects/new" ||
    (isProjectsIndexRoute &&
      (!projectView ||
        projectView === "projects" ||
        projectView === "milestones" ||
        projectView === "sprints")) ||
    (Boolean(projectId) && !isProjectEditRoute && (!projectView || projectView === "details"));
  const isProjectTasksRoute =
    pathname.includes("/tasks/") ||
    projectView === "kanban" ||
    projectView === "team" ||
    (isProjectsIndexRoute && projectView === "allTasks");
  const isProjectReportingRoute =
    projectView === "reports" || (isProjectsIndexRoute && projectView === "tasksAnalysis");
  const isProjectConfigurationRoute = isProjectEditRoute;
  const projectHeaderItems = isProjectsIndexRoute
    ? [
        {
          label: "Projects",
          href: "/projects",
          active: isProjectDetailsRoute,
        },
        {
          label: "Tasks",
          active: isProjectTasksRoute,
          menuItems: [
            {
              label: "My Tasks",
              disabled: true,
            },
            {
              label: "All Tasks",
              href: "/projects?view=allTasks",
              active: projectView === "allTasks",
            },
          ],
        },
        {
          label: "Reporting",
          active: isProjectReportingRoute,
          menuItems: [
            {
              label: "Tasks Analysis",
              href: "/projects?view=tasksAnalysis",
              active: projectView === "tasksAnalysis",
            },
            {
              label: "Customer Ratings",
              disabled: true,
            },
            {
              label: "Actual Margins",
              disabled: true,
            },
          ],
        },
      ]
    : [
        {
          label: "Projects",
          href: "/projects",
          active: isProjectDetailsRoute,
        },
        {
          label: "Tasks",
          href: projectId ? `/projects/${projectId}?view=kanban` : "/projects",
          active: isProjectTasksRoute,
          disabled: !projectId,
        },
        {
          label: "Reporting",
          href: projectId && user.role === "ADMIN" ? `/projects/${projectId}?view=reports` : undefined,
          active: isProjectReportingRoute,
          disabled: user.role !== "ADMIN" || !projectId,
        },
        {
          label: "Configuration",
          href: projectId
            ? isProjectEditRoute
              ? `/projects/${projectId}/edit`
              : `/projects/${projectId}?view=details`
            : "/projects",
          active: isProjectConfigurationRoute,
          disabled: !projectId,
        },
      ];
  const isCrmHomeRoute = pathname === "/crm";
  const isSalesQuotationsRoute = pathname === "/crm/quotations";
  const isSalesQuotationDetailRoute =
    pathSegments.length === 4 && pathSegments[0] === "crm" && pathSegments[2] === "quotations";
  const isSalesInvoiceDetailRoute =
    pathSegments.length === 5 &&
    pathSegments[0] === "crm" &&
    pathSegments[2] === "quotations" &&
    pathSegments[4] === "invoice";
  const isSalesInvoiceCreateRoute =
    pathSegments.length === 6 &&
    pathSegments[0] === "crm" &&
    pathSegments[2] === "quotations" &&
    pathSegments[4] === "invoice" &&
    pathSegments[5] === "create";
  const isEmbeddedCrmSalesRoute = isSalesQuotationsRoute && searchParams.get("embedded") === "crm";
  const isDashboardHomeRoute = pathname === "/dashboard";
  const isTeamManagementRoute = pathname.startsWith("/team-management");
  const isEmployeesRoute = pathname.startsWith("/employees");
  const isEmployeePerformanceRoute = pathname.startsWith("/employee-performance");
  const isClientsRoute = pathname.startsWith("/clients");
  const isCollegeDirectoryRoute = pathname === "/clients/colleges";
  const clientNavActiveLabel = isCollegeDirectoryRoute
    ? "manage-colleges"
    : "contacts";

  const sidebarButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-10 w-10 shrink-0 rounded-full border border-border bg-card text-foreground shadow-[var(--shadow-sm)] hover:bg-muted data-[state=open]:bg-muted"
      onClick={toggleSidebar}
      data-state={isSidebarOpen ? "open" : "closed"}
      data-skip-global-loading="true"
      aria-label={isSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );

  const headerActions = (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
      {hasMounted ? (
        <>
          {user.role !== "EMPLOYEE" ? <AdminMessageComposer userRole={user.role} /> : null}
          <ThemeToggle />
          <RoleHelpDialog role={user.role} />
          <NotificationBell userKey={user.id || user.email || user.name || "user"} />

          <div className="flex flex-col items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full sm:h-10 sm:w-10">
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">{roleLabel}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} disabled={isPending}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isPending ? "Signing out..." : "Sign out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <p className="text-[10px] font-semibold leading-none text-muted-foreground">{roleLabel}</p>
          </div>
        </>
      ) : (
        <HeaderActionsSkeleton showComposer={user.role !== "EMPLOYEE"} />
      )}
    </div>
  );

  const logoutConfirmDialog = (
    <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            Do you want to sign out of your account?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} disabled={isPending}>
            {isPending ? "Signing out..." : "Yes"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isCrmHomeRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <CrmModuleTopNav embedded />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isSalesQuotationsRoute && !isEmbeddedCrmSalesRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <SalesQuotationsModuleTopNav />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isSalesQuotationDetailRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <SalesQuotationsModuleTopNav />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isSalesInvoiceDetailRoute || isSalesInvoiceCreateRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <SalesQuotationsModuleTopNav forceActiveTab="to-invoice" />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isCrmRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <CrmModuleTopNav embedded />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isDashboardHomeRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <DashboardModuleTopNav
                role={user.role}
                moduleAccess={user.moduleAccess}
              />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isAdminRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              Admin
            </h1>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isClientsRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <div className="min-w-0 flex-1 px-1">
              <ClientsModuleTopNav
                activeLabel={clientNavActiveLabel}
                contactsHref="/clients"
                manageCollegesHref="/clients/colleges"
              />
            </div>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isEmployeePerformanceRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              Employee Performance
            </h1>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isTeamManagementRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              Group
            </h1>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  if (isEmployeesRoute) {
    return (
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-3 py-4 backdrop-blur sm:px-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {sidebarButton}
            <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">
              Employee
            </h1>
          </div>
          {headerActions}
        </div>
        {logoutConfirmDialog}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
        {sidebarButton}
        {isProjectsRoute ? (
          <div className="min-w-0 overflow-x-auto [scrollbar-width:none]">
            {hasMounted ? (
              <ProjectsModuleHeader
                items={projectHeaderItems}
                className="flex-nowrap gap-6 whitespace-nowrap text-sm sm:text-base"
              />
            ) : (
              <div className="h-5 w-72 rounded-full bg-muted/60" aria-hidden="true" />
            )}
          </div>
        ) : (
          <h2 className="truncate text-sm font-semibold tracking-tight sm:text-base md:text-lg">
            Employee Work Tracking
          </h2>
        )}
      </div>

      {headerActions}
      {logoutConfirmDialog}
    </header>
  );
}

