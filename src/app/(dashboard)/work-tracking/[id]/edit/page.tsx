import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getWorkTrackingOptions } from "@/actions/time-entry.actions";
import { ensureTimeEntrySchemaReady } from "@/lib/time-entry-schema.server";
import { TimeEntryForm } from "@/components/work-tracking/time-entry-form";

interface EditTimeEntryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTimeEntryPage({ params }: EditTimeEntryPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return null;
  if (
    session.user.role !== "ADMIN" &&
    !session.user.permissions.moduleAccess.includes("PROJECT")
  ) {
    notFound();
  }

  await ensureTimeEntrySchemaReady();

  const entry = await db.timeEntry.findUnique({
    where: { id },
  });

  if (!entry) {
    notFound();
  }

  // Admin can edit any time entry; everyone else can edit only their own.
  if (entry.userId !== session.user.id && session.user.role !== "ADMIN") {
    notFound();
  }

  const options = await getWorkTrackingOptions([entry.projectId]);
  const canManageOthers = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Time Entry</h1>
        <p className="text-muted-foreground">Update your time entry</p>
      </div>

      <TimeEntryForm
        entry={entry}
        projects={options.projects}
        tasks={options.tasks}
        employees={options.employees}
        currentUserId={session.user.id}
        currentUserName={session.user.name ?? "Current user"}
        canManageOthers={canManageOthers}
      />
    </div>
  );
}

