import type { TeamListItem } from "@/lib/teams";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamOverviewCard } from "@/components/teams/team-overview-card";

interface BaAssignedTeamsProps {
  teams: TeamListItem[];
}

export function BaAssignedTeams({ teams }: BaAssignedTeamsProps) {
  const totalMembers = teams.reduce((sum, team) => sum + team.members.length, 0);
  const totalLeaders = teams.reduce(
    (sum, team) => sum + team.members.filter((member) => member.role === "TEAMLEADER").length,
    0
  );

  return (
    <Card className="overflow-hidden rounded-[32px] border-slate-200/80 bg-white/90 shadow-[0_28px_60px_-45px_rgba(15,23,42,0.3)] backdrop-blur-xl">
      <CardHeader className="border-b border-white/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,0.98),rgba(248,250,252,0.92))]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-[24px] tracking-tight text-slate-950">Admin Assigned Teams</CardTitle>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Your active teams, roster, and leadership structure in one clear Fluent-style workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white/85 px-3 py-1 text-slate-700">
              {teams.length} teams
            </Badge>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white/85 px-3 py-1 text-slate-700">
              {totalMembers} members
            </Badge>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white/85 px-3 py-1 text-slate-700">
              {totalLeaders} leaders
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pt-4 pb-6">
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">No admin-assigned teams found.</p>
        ) : (
          <div className="grid content-start justify-start gap-2 [grid-template-columns:repeat(auto-fill,minmax(280px,360px))]">
            {teams.map((team) => (
              <TeamOverviewCard key={team.id} team={team} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
