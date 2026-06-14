"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getProjectWorkflowSelection,
  getProjectWorkflowState,
  saveProjectWorkflowSelection,
} from "@/actions/project-workflow.actions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectMilestone, ProjectSprint } from "@/lib/project-workflow-types";
import { toast } from "sonner";

interface ProjectWorkflowSelectionEditorProps {
  canEdit: boolean;
  projectId: string;
}

const NONE_VALUE = "__none__";
const CREATE_MILESTONE_VALUE = "__create_milestone__";
const CREATE_SPRINT_VALUE = "__create_sprint__";

function toSelectionValue(value: string | null) {
  return value ?? NONE_VALUE;
}

function fromSelectionValue(value: string) {
  return value === NONE_VALUE ? null : value;
}

export function ProjectWorkflowSelectionEditor({
  canEdit,
  projectId,
}: ProjectWorkflowSelectionEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState(NONE_VALUE);
  const [selectedSprintId, setSelectedSprintId] = useState(NONE_VALUE);

  useEffect(() => {
    let active = true;

    Promise.all([
      getProjectWorkflowState(projectId),
      getProjectWorkflowSelection(projectId),
    ])
      .then(([workflowState, selectionState]) => {
        if (!active) {
          return;
        }

        setMilestones(workflowState.milestones ?? []);
        setSprints(workflowState.sprints ?? []);
        setSelectedMilestoneId(toSelectionValue(selectionState.milestoneId));
        setSelectedSprintId(toSelectionValue(selectionState.sprintId));
        setLoadError(workflowState.error ?? selectionState.error ?? null);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setMilestones([]);
        setSprints([]);
        setSelectedMilestoneId(NONE_VALUE);
        setSelectedSprintId(NONE_VALUE);
        setLoadError("Unable to load workflow options");
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [projectId]);

  const selectedMilestone =
    milestones.find((milestone) => milestone.id === fromSelectionValue(selectedMilestoneId)) ??
    null;
  const selectedSprint =
    sprints.find((sprint) => sprint.id === fromSelectionValue(selectedSprintId)) ?? null;
  const milestoneTitleMap = useMemo(
    () => new Map(milestones.map((milestone) => [milestone.id, milestone.title])),
    [milestones]
  );
  const sprintOptions = sprints;

  const milestoneLabel = isLoading
    ? "Loading..."
    : loadError
      ? "Unable to load"
      : selectedMilestone?.title || (milestones.length === 0 ? "No milestones" : "Not assigned");

  const sprintLabel = isLoading
    ? "Loading..."
    : loadError
      ? "Unable to load"
      : selectedSprint?.name ||
        (sprints.length === 0 ? "No sprints" : "Not assigned");

  const openWorkflowCreate = (section: "milestones" | "sprints") => {
    const params = new URLSearchParams();
    params.set("view", section);
    params.set("projectId", projectId);
    params.set("focus", section === "milestones" ? "createMilestone" : "createSprint");
    router.push(`/projects?${params.toString()}`);
  };

  const persistSelection = (nextMilestoneId: string, nextSprintId: string) => {
    const previousMilestoneId = selectedMilestoneId;
    const previousSprintId = selectedSprintId;

    setSelectedMilestoneId(nextMilestoneId);
    setSelectedSprintId(nextSprintId);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);

      const milestoneId = fromSelectionValue(nextMilestoneId);
      const sprintId = fromSelectionValue(nextSprintId);

      if (milestoneId) {
        formData.set("milestoneId", milestoneId);
      }

      if (sprintId) {
        formData.set("sprintId", sprintId);
      }

      const result = await saveProjectWorkflowSelection(formData);
      if (result.error) {
        setSelectedMilestoneId(previousMilestoneId);
        setSelectedSprintId(previousSprintId);
        toast.error(result.error);
        return;
      }

      setSelectedMilestoneId(toSelectionValue(result.milestoneId ?? null));
      setSelectedSprintId(toSelectionValue(result.sprintId ?? null));
      toast.success("Milestone and sprint updated");
    });
  };

  const handleMilestoneChange = (value: string) => {
    if (value === CREATE_MILESTONE_VALUE) {
      openWorkflowCreate("milestones");
      return;
    }

    const nextSprintId =
      value !== NONE_VALUE && selectedSprint?.milestoneId === value
        ? selectedSprintId
        : NONE_VALUE;

    persistSelection(value, nextSprintId);
  };

  const handleSprintChange = (value: string) => {
    if (value === CREATE_SPRINT_VALUE) {
      openWorkflowCreate("sprints");
      return;
    }

    if (value === NONE_VALUE) {
      persistSelection(selectedMilestoneId, NONE_VALUE);
      return;
    }

    const nextSprint = sprints.find((sprint) => sprint.id === value) ?? null;
    const nextMilestoneId = nextSprint
      ? toSelectionValue(nextSprint.milestoneId || null)
      : selectedMilestoneId;

    persistSelection(nextMilestoneId, value);
  };

  const triggerClassName =
    "h-auto w-full justify-between rounded-none border-0 border-b border-slate-300 bg-transparent px-0 pb-1.5 pt-0 text-left text-[1.02rem] font-medium text-slate-900 shadow-none hover:border-slate-500 focus-visible:border-slate-500 focus-visible:ring-0";

  return (
    <>
      <div className="grid grid-cols-[140px_1fr] items-center gap-3 xl:grid-cols-[150px_1fr] xl:gap-4">
        <p className="text-[0.95rem] font-semibold text-slate-900">Milestone</p>
        {canEdit && !isLoading && !loadError ? (
          <Select
            disabled={isPending}
            value={selectedMilestoneId}
            onValueChange={handleMilestoneChange}
          >
            <SelectTrigger className={triggerClassName} aria-label="Select project milestone">
              <SelectValue placeholder={milestones.length === 0 ? "Create milestone" : "Select milestone"} />
            </SelectTrigger>
            <SelectContent align="end" className="border-slate-200 bg-white">
              <SelectGroup>
                <SelectLabel>Created milestones</SelectLabel>
                <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                {milestones.map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </SelectItem>
                ))}
              </SelectGroup>
              {canEdit ? (
                <>
                  <SelectSeparator />
                  <SelectItem value={CREATE_MILESTONE_VALUE}>Create milestone</SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[1.02rem] font-medium text-slate-900">{milestoneLabel}</span>
        )}
      </div>

      <div className="grid grid-cols-[140px_1fr] items-center gap-3 xl:grid-cols-[150px_1fr] xl:gap-4">
        <p className="text-[0.95rem] font-semibold text-slate-900">Sprint</p>
        {canEdit && !isLoading && !loadError ? (
          <Select
            disabled={isPending}
            value={selectedSprintId}
            onValueChange={handleSprintChange}
          >
            <SelectTrigger className={triggerClassName} aria-label="Select project sprint">
              <SelectValue placeholder={sprints.length === 0 ? "Create sprint" : "Select sprint"} />
            </SelectTrigger>
            <SelectContent align="end" className="border-slate-200 bg-white">
              <SelectGroup>
                <SelectLabel>Created sprints</SelectLabel>
                <SelectItem value={NONE_VALUE}>Not assigned</SelectItem>
                {sprintOptions.map((sprint) => (
                  <SelectItem key={sprint.id} value={sprint.id}>
                    {milestoneTitleMap.get(sprint.milestoneId)
                      ? `${sprint.name} - ${milestoneTitleMap.get(sprint.milestoneId)}`
                      : sprint.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              {canEdit ? (
                <>
                  <SelectSeparator />
                  <SelectItem value={CREATE_SPRINT_VALUE}>Create sprint</SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[1.02rem] font-medium text-slate-900">{sprintLabel}</span>
        )}
      </div>
    </>
  );
}
