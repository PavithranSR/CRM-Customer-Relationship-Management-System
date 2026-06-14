import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";
import { SettingsDetails } from "@/components/settings/settings-details";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      permissions: true,
    },
  });

  if (!user) {
    redirect("/dashboard");
  }

  const permissions = normalizeEmployeePermissions(user.permissions);

  return (
    <SettingsDetails
      email={user.email}
      moduleAccess={permissions.moduleAccess}
      actionPermissions={permissions.actionPermissions}
      recordRules={permissions.recordRules}
      fieldLevelPermissions={permissions.fieldLevelPermissions}
    />
  );
}
