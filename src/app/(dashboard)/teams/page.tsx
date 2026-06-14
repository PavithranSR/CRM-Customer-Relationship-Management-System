import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamsForMember } from "@/lib/team-store.server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FolderKanban } from "lucide-react";
import { BaAssignedTeams } from "@/components/teams/ba-assigned-teams";

export default async function TeamsPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "BA") {
    redirect("/dashboard");
  }

  const assignedTeams = await getTeamsForMember(session.user.id);

  const projectTeams = await db.project.findMany({
    where: {
      type: "TEAM",
      managerId: session.user.id,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      priority: true,
      assignments: {
        where: { isActive: true },
        select: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Teams</h1>
        <p className="text-muted-foreground">Teams assigned to you by admin</p>
      </div>

      <BaAssignedTeams teams={assignedTeams} />

      {projectTeams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No teams assigned yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projectTeams.map((team) => (
            <Card key={team.id}>
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{team.name}</CardTitle>
                  <Badge variant="outline">{team.code}</Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FolderKanban className="h-4 w-4" />
                  <span>{team.status.replace("_", " ")}</span>
                  <Badge variant="secondary">{team.priority}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{team.assignments.length} members</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {team.assignments.map((assignment) => (
                    <Badge key={assignment.user.id} variant="secondary">
                      {assignment.user.name} ({assignment.user.role})
                    </Badge>
                  ))}
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/projects/${team.id}`}>Open Team Project</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

