"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CommonMilestonesWorkspace } from "@/components/projects/common-milestones-workspace";
import { ProjectMilestoneSprintWorkspace } from "@/components/projects/project-milestone-sprint-workspace";
import { Card, CardContent } from "@/components/ui/card";

interface ProjectsWorkflowViewProps {
  canManage: boolean;
  projects: Array<{
    id: string;
    name: string;
    code: string;
    startDate?: string | null;
    deadline?: string | null;
    teamMembers: Array<{
      id: string;
      name: string;
      role?: string | null;
    }>;
  }>;
  section: "milestones" | "sprints";
}

const subscribe = () => () => {};

export function ProjectsWorkflowView({
  canManage,
  projects,
  section,
}: ProjectsWorkflowViewProps) {
  const searchParams = useSearchParams();
  const isHydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const requestedProjectId = searchParams.get("projectId") ?? "";
  const resolvedProjectId =
    projects.find((project) => project.id === requestedProjectId)?.id ?? projects[0]?.id ?? "";

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === resolvedProjectId) ?? projects[0] ?? null,
    [projects, resolvedProjectId]
  );

  const sectionLabel = section === "milestones" ? "Common Milestones" : "Sprints";

  if (!selectedProject) {
    return (
      <CommonMilestonesWorkspace canManage={canManage} />
    );
  }

  if (!isHydrated) {
    return (
      <div className="space-y-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col gap-3 p-4">
            <p className="text-sm font-semibold text-slate-900">{sectionLabel}</p>
            <p className="text-sm text-slate-500">Loading {sectionLabel.toLowerCase()} workspace...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProjectMilestoneSprintWorkspace
        key={`${section}-${selectedProject.id}`}
        projectId={selectedProject.id}
        section={section}
        canManage={canManage}
        projectStartDate={selectedProject.startDate}
        projectDeadline={selectedProject.deadline}
        teamMembers={selectedProject.teamMembers}
      />
    </div>
  );
}
