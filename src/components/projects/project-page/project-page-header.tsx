import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  projectPriorityColors,
  projectStatusColors,
  type ProjectPageProject,
} from "./project-page-helpers";

interface ProjectPageHeaderProps {
  project: ProjectPageProject;
  actions?: ReactNode;
  showBadges?: boolean;
}

export function ProjectPageHeader({
  project,
  actions,
  showBadges = false,
}: ProjectPageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {showBadges ? (
              <>
                <Badge className={projectStatusColors[project.status]}>
                  {project.status.replace("_", " ")}
                </Badge>
                <Badge className={projectPriorityColors[project.priority]}>{project.priority}</Badge>
              </>
            ) : null}
          </div>
          <p className="text-muted-foreground">{project.code}</p>
        </div>
      </div>
      {actions ? <div className="flex gap-2">{actions}</div> : null}
    </div>
  );
}

interface ProjectViewToggleProps {
  activeView: "kanban" | "team";
  projectId: string;
  showTeamLink: boolean;
}

export function ProjectViewToggle({
  activeView,
  projectId,
  showTeamLink,
}: ProjectViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border bg-background p-1">
      <Button asChild variant={activeView === "kanban" ? "ghost" : "outline"} size="sm">
        <Link href={`/projects/${projectId}?view=kanban`}>Tasks</Link>
      </Button>
      {showTeamLink ? (
        <Button asChild variant={activeView === "team" ? "ghost" : "outline"} size="sm">
          <Link href={`/projects/${projectId}?view=team`}>Team</Link>
        </Button>
      ) : null}
    </div>
  );
}
