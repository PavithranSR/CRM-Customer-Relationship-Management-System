import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTimeEntries, getWorkTrackingOptions } from "@/actions/time-entry.actions";
import { WorkTrackingDashboard } from "@/components/work-tracking/work-tracking-dashboard";

export default async function WorkTrackingPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    redirect("/dashboard");
  }

  const hasTeamScope = session.user.role === "ADMIN";
  const canManageOthers = session.user.role === "ADMIN";
  const [entries, options] = await Promise.all([
    getTimeEntries(),
    getWorkTrackingOptions(),
  ]);

  return (
    <WorkTrackingDashboard
      entries={entries}
      projects={options.projects}
      tasks={options.tasks}
      employees={options.employees}
      currentUserId={session.user.id}
      currentUserName={session.user.name ?? "Current user"}
      showEmployeeColumn={hasTeamScope}
      canManageOthers={canManageOthers}
    />
  );
}

