"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { ArrowLeft, Rocket, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectTask } from "@/lib/project-task-utils";
import type { ProjectMilestone, ProjectSprint } from "@/lib/project-workflow-types";
import {
  getDerivedMilestoneStatus,
  getMilestoneCompletionPercent,
  getMilestoneCompletedSprintCount,
  getMilestonePendingSprintCount,
  getMilestoneSprints,
  getMilestoneSprintCount,
  getMilestoneStatusLabel,
  getMilestoneTaskCount,
  getSprintDeadlineLabel,
  getSprintProgressPercent,
  getSprintTaskCount,
} from "@/lib/project-workflow-utils";

type MilestoneViewMode = "projects" | "sprints";

interface MilestoneProjectRow {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  priority: string;
  progress: number;
  deadline: Date | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string } }[];
}

interface ProjectMilestoneTaskLinkPageProps {
  projectId: string;
  projectName: string;
  projectCode: string;
  milestone: ProjectMilestone;
  relatedProjects: MilestoneProjectRow[];
  sprints: ProjectSprint[];
  tasks: ProjectTask[];
}

function formatMilestoneDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not set" : format(parsed, "dd MMM yyyy");
}

function formatProjectDeadline(value: Date | null) {
  return value ? format(value, "dd MMM yyyy") : "-";
}

function getProjectTeamLabel(project: MilestoneProjectRow) {
  if (project.assignments.length === 0) {
    return "No team";
  }

  if (project.assignments.length === 1) {
    return project.assignments[0]?.user.name ?? "1 member";
  }

  return `${project.assignments.length} members`;
}

export function ProjectMilestoneTaskLinkPage({
  projectId,
  projectName,
  projectCode,
  milestone,
  relatedProjects,
  sprints,
  tasks,
}: ProjectMilestoneTaskLinkPageProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<MilestoneViewMode>("projects");

  const relatedSprints = useMemo(
    () => getMilestoneSprints(milestone, sprints),
    [milestone, sprints]
  );
  const milestoneStatus = getDerivedMilestoneStatus(milestone, tasks, sprints);
  const milestoneProgress = getMilestoneCompletionPercent(milestone, tasks, sprints);
  const milestoneTaskCount = getMilestoneTaskCount(milestone, sprints);
  const milestoneSprintCount = getMilestoneSprintCount(milestone, sprints);
  const completedSprintCount = getMilestoneCompletedSprintCount(milestone, sprints, tasks);
  const pendingSprintCount = getMilestonePendingSprintCount(milestone, sprints, tasks);

  const projectRows = useMemo(
    () =>
      [...relatedProjects].sort((left, right) => {
        if (left.name === right.name) {
          return left.code.localeCompare(right.code);
        }
        return left.name.localeCompare(right.name);
      }),
    [relatedProjects]
  );

  const handleBack = () => {
    router.push(`/projects/${projectId}?view=milestones`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Back to milestones">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{milestone.title}</h1>
          <p className="truncate text-sm text-slate-500">
            {projectName} {projectCode ? `- ${projectCode}` : ""}
          </p>
        </div>
        <Badge variant="outline">Milestone Overview</Badge>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-lg font-semibold text-slate-900">{milestone.title}</p>
              <p className="text-sm text-slate-500">{milestone.description || "No description"}</p>
            </div>
            <Badge>{getMilestoneStatusLabel(milestoneStatus)}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Start</p>
              <p className="mt-2 font-medium text-slate-900">{formatMilestoneDate(milestone.startDate)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Target</p>
              <p className="mt-2 font-medium text-slate-900">{formatMilestoneDate(milestone.targetDate)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Owner</p>
              <p className="mt-2 font-medium text-slate-900">{milestone.ownerName || "Unassigned"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Linked Work</p>
              <p className="mt-2 font-medium text-slate-900">{milestoneTaskCount}</p>
              <Progress value={milestoneProgress} className="mt-3 h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200 bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {viewMode === "projects" ? <Target className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                {viewMode === "projects" ? "Project" : "Sprint"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                {viewMode === "projects"
                  ? "Projects currently using this milestone."
                  : "Sprints created inside this milestone."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "projects" ? "default" : "outline"}
                onClick={() => setViewMode("projects")}
              >
                Project
              </Button>
              <Button
                type="button"
                variant={viewMode === "sprints" ? "default" : "outline"}
                onClick={() => setViewMode("sprints")}
              >
                Sprint
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === "projects" ? (
            <ScrollArea className="h-[60vh]">
              <div className="min-w-[1080px]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Project</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Team</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">
                          No projects are linked to this milestone yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      projectRows.map((project) => (
                        <TableRow key={project.id}>
                          <TableCell className="font-medium text-slate-900">
                            <Link href={`/projects/${project.id}`} className="hover:underline">
                              {project.name}
                            </Link>
                            <p className="text-xs text-slate-500">{project.code}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{project.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{String(project.status).replaceAll("_", " ")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-blue-400 text-white hover:bg-blue-400">
                              {project.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={project.progress ?? 0} className="h-2 w-24" />
                              <span className="text-sm text-slate-700">{project.progress ?? 0}%</span>
                            </div>
                          </TableCell>
                          <TableCell>{formatProjectDeadline(project.deadline)}</TableCell>
                          <TableCell>{project.manager?.name ?? "Unassigned"}</TableCell>
                          <TableCell>{getProjectTeamLabel(project)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="min-w-[860px]">
                <div className="flex flex-wrap gap-3 px-6 py-5 text-sm text-slate-600">
                  <span>{milestoneSprintCount} total</span>
                  <span>{completedSprintCount} completed</span>
                  <span>{pendingSprintCount} pending</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Sprint</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tasks</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedSprints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">
                          No sprints have been created for this milestone yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      relatedSprints.map((sprint) => {
                        const taskCount = getSprintTaskCount(sprint);
                        const progress = getSprintProgressPercent(sprint, tasks);

                        return (
                          <TableRow key={sprint.id}>
                            <TableCell className="font-medium text-slate-900">
                              {sprint.name}
                              <p className="text-xs text-slate-500">{getSprintDeadlineLabel(sprint)}</p>
                            </TableCell>
                            <TableCell>{sprint.goal || "No sprint goal provided"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{sprint.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-slate-900">{taskCount}</p>
                                <p className="text-xs text-slate-500">
                                  {taskCount === 0 ? "No tasks yet" : `${taskCount} work items`}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={progress} className="h-2 w-24" />
                                <span className="text-sm text-slate-700">{progress}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
