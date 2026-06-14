import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardSidebarProvider } from "@/components/layout/dashboard-sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DashboardMainShell } from "@/components/layout/dashboard-main-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DashboardSidebarProvider>
      <div className="flex min-h-screen bg-transparent md:h-screen md:overflow-hidden">
        <Sidebar userRole={session.user.role} moduleAccess={session.user.moduleAccess} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Header user={session.user} />
          <DashboardMainShell>{children}</DashboardMainShell>
        </div>
        <Toaster />
      </div>
    </DashboardSidebarProvider>
  );
}
