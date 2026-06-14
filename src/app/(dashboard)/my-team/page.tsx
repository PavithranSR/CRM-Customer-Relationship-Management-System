import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getTeamsForMember } from "@/lib/team-store.server";
import { BaAssignedTeams } from "@/components/teams/ba-assigned-teams";

export default async function MyTeamPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "BA") {
    redirect("/dashboard");
  }

  const teams = await getTeamsForMember(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Team</h1>
        <p className="text-muted-foreground">Teams assigned to you by admin (view only)</p>
      </div>

      <BaAssignedTeams teams={teams} />
    </div>
  );
}

