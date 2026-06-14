"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ScheduleSnapshot {
  liveTasks: number;
  liveOpenTasks: number;
  liveCompletedTasks: number;
  liveEmployees: number;
  liveTeamLeaders: number;
  activeProjects: number;
  onTrackProjects: number;
  atRiskProjects: number;
  liveRemainingHours: number;
  liveCapacityPerDay: number;
  suggestedCompletionDays: number;
  suggestedCompletionDate: string;
  availableBAs: number;
  availableTeamLeaders: number;
  availableEmployees: number;
  avgEmployeeCapacityPerDay: number;
  recommendedTeams: number;
  recommendedTeamSize: number;
}

interface ScheduleProjectRow {
  id: string;
  name: string;
  code: string;
  revenue: number;
  priority: string;
  status: string;
  totalTasks: number;
  openTasks: number;
  remainingHours: number;
  assignedEmployees: number;
  onTrack: boolean;
}

interface ScheduleAiPlannerProps {
  snapshot: ScheduleSnapshot;
  revenueQueue: ScheduleProjectRow[];
  dataUnavailableReason?: string;
}

interface TeamSummaryRow {
  team: string;
  members: number;
  totalProjects: number;
  oneProjectDurationDays: number;
  perPersonProjects: string;
  teamExpectedCompletionDays: number;
}

function safeInt(value: number, min = 1) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.floor(value));
}

export function ScheduleAiPlanner({ dataUnavailableReason }: ScheduleAiPlannerProps) {
  const [totalProjects, setTotalProjects] = useState<number>(100);
  const [totalEmployees, setTotalEmployees] = useState<number>(30);
  const [totalTeams, setTotalTeams] = useState<number>(5);
  const [durationDays, setDurationDays] = useState<number>(60);
  const [includeTeamLeaderInWork, setIncludeTeamLeaderInWork] = useState<boolean>(true);

  const analysis = useMemo(() => {
    const projects = safeInt(totalProjects, 1);
    const employees = safeInt(totalEmployees, 1);
    const teams = safeInt(totalTeams, 1);
    const planDays = safeInt(durationDays, 1);

    const baseMembersPerTeam = Math.floor(employees / teams);
    const extraMembers = employees % teams;

    const baseProjectsPerTeam = Math.floor(projects / teams);
    const extraProjects = projects % teams;
    const contributors = includeTeamLeaderInWork
      ? employees
      : Math.max(1, employees - teams);
    const projectsPerContributor = projects / Math.max(1, contributors);
    // AI-derived duration per project based on requested overall duration and contributor load.
    const perProjectDays = Math.max(1, Math.floor(planDays / Math.max(1, projectsPerContributor)));

    const teamSummary: TeamSummaryRow[] = [];
    let maxTeamCompletionDays = 0;

    for (let teamIndex = 0; teamIndex < teams; teamIndex += 1) {
      const teamName = `Team ${teamIndex + 1}`;
      const membersInTeam = baseMembersPerTeam + (teamIndex < extraMembers ? 1 : 0);
      const teamProjects = baseProjectsPerTeam + (teamIndex < extraProjects ? 1 : 0);

      if (membersInTeam <= 0) continue;

      // Build team members. Index 0 is leader by convention.
      const members = Array.from({ length: membersInTeam }, (_, memberIndex) => ({
        name: memberIndex === 0 ? `${teamName}-Leader` : `${teamName}-Member ${memberIndex}`,
        isLeader: memberIndex === 0,
        assignedProjects: 0,
      }));

      const contributorIndices = members
        .map((member, idx) => ({ member, idx }))
        .filter(({ member }) => includeTeamLeaderInWork || !member.isLeader)
        .map(({ idx }) => idx);

      if (contributorIndices.length === 0) continue;

      const perContributorBase = Math.floor(teamProjects / contributorIndices.length);
      const perContributorExtra = teamProjects % contributorIndices.length;

      contributorIndices.forEach((memberIndex, idx) => {
        members[memberIndex].assignedProjects =
          perContributorBase + (idx < perContributorExtra ? 1 : 0);
      });

      let teamCompletionDays = 0;
      members.forEach((member) => {
        const expectedDays = member.assignedProjects * perProjectDays;
        teamCompletionDays = Math.max(teamCompletionDays, expectedDays);
      });

      const projectLoad = Array.from(
        new Set(
          members
            .filter((member) => includeTeamLeaderInWork || !member.isLeader)
            .map((member) => member.assignedProjects)
        )
      ).sort((a, b) => a - b);
      const perPersonProjects =
        projectLoad.length === 1
          ? `${projectLoad[0]}`
          : `${projectLoad[0]} - ${projectLoad[projectLoad.length - 1]}`;

      teamSummary.push({
        team: teamName,
        members: membersInTeam,
        totalProjects: teamProjects,
        oneProjectDurationDays: perProjectDays,
        perPersonProjects,
        teamExpectedCompletionDays: teamCompletionDays,
      });

      maxTeamCompletionDays = Math.max(maxTeamCompletionDays, teamCompletionDays);
    }

    const requiredContributors = Math.ceil((projects * perProjectDays) / planDays);
    const additionalContributorsNeeded = Math.max(0, requiredContributors - contributors);

    const feasible = maxTeamCompletionDays <= planDays;
    const suggestedTeamsByLoad = Math.max(1, Math.ceil(requiredContributors / Math.max(1, baseMembersPerTeam)));

    return {
      contributors,
      requiredContributors,
      additionalContributorsNeeded,
      teamProjects: Math.ceil(projects / teams),
      projectsPerContributor: Number(projectsPerContributor.toFixed(2)),
      aiProjectDurationDays: perProjectDays,
      expectedTotalCompletionDays: maxTeamCompletionDays,
      feasible,
      suggestedTeamsByLoad,
      teamSummary,
    };
  }, [
    durationDays,
    includeTeamLeaderInWork,
    totalEmployees,
    totalProjects,
    totalTeams,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Schedule Planning</h1>
        <p className="text-sm text-muted-foreground">
          Team-based project assignment optimizer with best-performer balancing and completion timeline analysis.
        </p>
      </div>

      {dataUnavailableReason ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Live database data is currently unavailable. Manual planning still works. Reason: {dataUnavailableReason}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Manual Inputs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Projects</p>
              <Input type="number" min={1} value={totalProjects} onChange={(e) => setTotalProjects(Number(e.target.value || 1))} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Total Employees</p>
              <Input type="number" min={1} value={totalEmployees} onChange={(e) => setTotalEmployees(Number(e.target.value || 1))} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Teams</p>
              <Input type="number" min={1} value={totalTeams} onChange={(e) => setTotalTeams(Number(e.target.value || 1))} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Duration (Days)</p>
              <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value || 1))} />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Team Leader Working Mode</p>
              <select
                value={includeTeamLeaderInWork ? "working" : "monitoring"}
                onChange={(e) => setIncludeTeamLeaderInWork(e.target.value === "working")}
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="working">Leader works + monitors</option>
                <option value="monitoring">Leader monitors only</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Projects per Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.teamProjects}</div>
            <p className="text-xs text-muted-foreground">Equal split baseline</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.contributors}</div>
            <p className="text-xs text-muted-foreground">Based on leader mode</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI Project Duration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.aiProjectDurationDays} days</div>
            <p className="text-xs text-muted-foreground">
              Auto-calculated from duration and workload
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expected Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analysis.expectedTotalCompletionDays} days</div>
            <p className="text-xs text-muted-foreground">
              {analysis.feasible ? "Within target duration" : "Exceeds target duration"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Adjustment Need</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{analysis.additionalContributorsNeeded}</div>
            <p className="text-xs text-muted-foreground">
              Suggested teams by load: {analysis.suggestedTeamsByLoad}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team-Wise Expert Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Team</th>
                  <th className="px-3 py-2">Team Tasks</th>
                  <th className="px-3 py-2">One Project Duration</th>
                  <th className="px-3 py-2">Per Person Tasks</th>
                  <th className="px-3 py-2">Team Expected Completion</th>
                </tr>
              </thead>
              <tbody>
                {analysis.teamSummary.map((row) => (
                  <tr key={row.team} className="border-b">
                    <td className="px-3 py-2 font-medium">{row.team}</td>
                    <td className="px-3 py-2">{row.totalProjects}</td>
                    <td className="px-3 py-2">{row.oneProjectDurationDays} days</td>
                    <td className="px-3 py-2">{row.perPersonProjects} tasks/person</td>
                    <td className="px-3 py-2">{row.teamExpectedCompletionDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Projects are first split team-wise as evenly as possible.</p>
          <p>2. Team members then receive equal project shares.</p>
          <p>3. One project duration is auto-set by AI from your total duration and workload.</p>
          <p>4. Team tasks and per-person tasks are generated from that AI duration.</p>
          <p>5. If expected completion exceeds target duration, add contributors.</p>
        </CardContent>
      </Card>
    </div>
  );
}
