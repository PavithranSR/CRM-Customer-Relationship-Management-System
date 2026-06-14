import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamNameForUser } from "@/lib/team-store.server";
import { ProfileDetails } from "@/components/profile/profile-details";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      department: true,
      position: true,
      assignments: {
        where: { isActive: true },
        select: {
          project: {
            select: {
              id: true,
              name: true,
              manager: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect("/dashboard");
  }

  const teamName = await getTeamNameForUser(session.user.id);

  const reportingManagers = Array.from(
    new Map(
      user.assignments
        .map((assignment) => assignment.project.manager)
        .filter((manager): manager is { id: string; name: string } => Boolean(manager))
        .map((manager) => [manager.id, manager.name])
    ).values()
  );

  return (
    <ProfileDetails
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        position: user.position,
      }}
      teamName={teamName ?? "-"}
      assignedProjects={user.assignments.map((assignment) => ({
        id: assignment.project.id,
        name: assignment.project.name,
      }))}
      reportingTo={reportingManagers}
    />
  );
}
