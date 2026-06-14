"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isAfter, isBefore, isValid, parseISO } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ClipboardList,
  FilterX,
  MoreHorizontal,
  PenSquare,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { getProjectWorkflowState, saveProjectMilestones, saveProjectSprints } from "@/actions/project-workflow.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ProjectTask,
} from "@/lib/project-task-utils";
import type {
  MilestoneStatus,
  ProjectMilestone,
  ProjectSprint,
  SprintStatus,
} from "@/lib/project-workflow-types";
import {
  MILESTONE_STATUS_OPTIONS,
  SPRINT_STATUS_OPTIONS,
  getDerivedMilestoneStatus,
  getMilestoneCompletionPercent,
  getMilestoneCompletedSprintCount,
  getMilestonePendingSprintCount,
  getMilestoneSprintCount,
  getMilestoneStatusLabel,
  getMilestoneTaskCount,
  getProjectWorkflowCompletionPercent,
  getSprintCompletedTaskCount,
  getSprintDeadlineLabel,
  getSprintPendingTaskCount,
  getSprintProgressPercent,
  getTaskMilestoneId,
  isMilestoneDelayed,
  isMilestoneUpcoming,
  isSprintOverdue,
  isSprintWithinMilestoneWindow,
  sortMilestonesByDate,
  sortSprintsByDate,
} from "@/lib/project-workflow-utils";

type SectionKey = "milestones" | "sprints";

interface ProjectMilestoneSprintWorkspaceProps {
  projectId: string;
  section: SectionKey;
  canManage: boolean;
  canCreateSharedMilestones?: boolean;
  projectStartDate?: string | null;
  projectDeadline?: string | null;
  teamMembers?: Array<{
    id: string;
    name: string;
    role?: string | null;
  }>;
}

interface MilestoneTaskDraftState {
  included: boolean;
  required: boolean;
}

type MilestoneDraftState = ReturnType<typeof makeMilestoneDraft>;

function toWorkflowDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatWorkflowDateInput(value?: string | null) {
  const parsed = toWorkflowDate(value);
  return parsed ? format(parsed, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
}

function makeMilestoneDraft() {
  return {
    title: "",
    description: "",
    startDate: "",
    targetDate: "",
    status: "NOT_STARTED" as MilestoneStatus,
    ownerId: "unassigned",
  };
}

function makeSprintDraft(milestone?: Pick<ProjectMilestone, "startDate" | "targetDate" | "id"> | null) {
  return {
    name: "",
    goal: "",
    milestoneId: milestone?.id ?? "",
    startDate: "",
    endDate: "",
    status: "PLANNED" as SprintStatus,
    ownerId: "unassigned",
    ownerName: "",
    teamMemberIds: [] as string[],
  };
}

function makeMilestoneDraftFromMilestone(milestone: ProjectMilestone): MilestoneDraftState {
  return {
    title: milestone.title,
    description: milestone.description,
    startDate: formatWorkflowDateInput(milestone.startDate),
    targetDate: formatWorkflowDateInput(milestone.targetDate),
    status: milestone.status,
    ownerId: milestone.ownerId ?? "unassigned",
  };
}

export function ProjectMilestoneSprintWorkspace({
  projectId,
  section,
  canManage,
  canCreateSharedMilestones = true,
  projectStartDate,
  projectDeadline,
  teamMembers = [],
}: ProjectMilestoneSprintWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);

  const [milestoneSearch, setMilestoneSearch] = useState("");
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<MilestoneStatus | "all">("all");
  const [milestoneDateFilter, setMilestoneDateFilter] = useState<"all" | "upcoming" | "overdue" | "reached">("all");
  const [milestoneDraft, setMilestoneDraft] = useState(() => makeMilestoneDraft());
  const [milestoneEditorDraft, setMilestoneEditorDraft] = useState<MilestoneDraftState>(() => makeMilestoneDraft());
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [milestoneDialogId, setMilestoneDialogId] = useState<string | null>(null);
  const [milestoneEditorOpen, setMilestoneEditorOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneTaskDraft, setMilestoneTaskDraft] = useState<Record<string, MilestoneTaskDraftState>>({});
  const [isSavingMilestones, setIsSavingMilestones] = useState(false);
  const [createMilestoneDialogOpen, setCreateMilestoneDialogOpen] = useState(false);
  const [createSprintDialogOpen, setCreateSprintDialogOpen] = useState(false);
  const focusTarget = searchParams.get("focus");

  const [sprintDraft, setSprintDraft] = useState(() => makeSprintDraft());
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [sprintListSearch, setSprintListSearch] = useState("");
  const [sprintListStatusFilter, setSprintListStatusFilter] = useState<SprintStatus | "all">("all");
  const [sprintListMilestoneFilter, setSprintListMilestoneFilter] = useState("all");
  const [isSavingSprints, setIsSavingSprints] = useState(false);

  useEffect(() => {
    let alive = true;

    getProjectWorkflowState(projectId).then((result) => {
      if (!alive) return;
      if (result.error) {
        toast.error(result.error);
      }
      setTasks(result.tasks ?? []);
      setMilestones(result.milestones ?? []);
      setSprints(result.sprints ?? []);
      setSelectedSprintId((current) => current ?? result.sprints?.find((sprint) => sprint.status === "ACTIVE")?.id ?? result.sprints?.[0]?.id ?? null);
      setIsLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [projectId]);

  const isCreateMilestoneFocusActive =
    canManage && section === "milestones" && focusTarget === "createMilestone";
  const isCreateMilestonePanelOpen =
    canManage && (createMilestoneDialogOpen || isCreateMilestoneFocusActive);
  const isCreateSprintFocusActive =
    canManage && section === "sprints" && focusTarget === "createSprint";
  const isCreateSprintPanelOpen =
    canManage && (createSprintDialogOpen || isCreateSprintFocusActive);

  const clearFocusQueryParam = () => {
    if (!focusTarget) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("focus");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/projects?${nextQuery}` : "/projects");
  };

  const handleCreateMilestoneDialogOpenChange = (open: boolean) => {
    if (open) {
      setMilestoneDraft(makeMilestoneDraft());
    }
    setCreateMilestoneDialogOpen(open);

    if (!open && isCreateMilestoneFocusActive) {
      clearFocusQueryParam();
    }
  };

  const handleCreateSprintDialogOpenChange = (open: boolean) => {
    if (open) {
      setSprintDraft(makeSprintDraft());
    }
    setCreateSprintDialogOpen(open);

    if (!open && isCreateSprintFocusActive) {
      clearFocusQueryParam();
    }
  };

  const refreshState = () => {
    setIsLoading(true);
    getProjectWorkflowState(projectId).then((result) => {
      setTasks(result.tasks ?? []);
      setMilestones(result.milestones ?? []);
      setSprints(result.sprints ?? []);
      setSelectedSprintId((current) => current ?? result.sprints?.find((sprint) => sprint.status === "ACTIVE")?.id ?? result.sprints?.[0]?.id ?? null);
      setIsLoading(false);
    });
  };

  const persistMilestones = (nextMilestones: ProjectMilestone[]) => {
    setIsSavingMilestones(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("milestones", JSON.stringify(nextMilestones));

    startTransition(async () => {
      const result = await saveProjectMilestones(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setMilestones(result.milestones ?? nextMilestones);
        toast.success("Milestones updated");
      }
      setIsSavingMilestones(false);
    });
  };

  const persistSprints = (nextSprints: ProjectSprint[]) => {
    setIsSavingSprints(true);
    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("sprints", JSON.stringify(nextSprints));

    startTransition(async () => {
      const result = await saveProjectSprints(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setSprints(result.sprints ?? nextSprints);
        toast.success("Sprints updated");
      }
      setIsSavingSprints(false);
    });
  };

  const teamMemberMap = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member])),
    [teamMembers]
  );
  const getMemberName = (memberId?: string | null) => {
    if (!memberId) {
      return "Unassigned";
    }

    return teamMemberMap.get(memberId)?.name ?? memberId;
  };
  const getTaskAssigneeDisplay = (task: ProjectTask) =>
    getMemberName(task.employeeAssigneeId?.trim() || task.assigneeId?.trim() || "");
  const projectWindow = useMemo(
    () => ({
      start: toWorkflowDate(projectStartDate),
      end: toWorkflowDate(projectDeadline),
    }),
    [projectDeadline, projectStartDate]
  );
  const hasMilestoneFiltersActive =
    milestoneSearch.trim().length > 0 ||
    milestoneStatusFilter !== "all" ||
    milestoneDateFilter !== "all";

  const milestoneSummary = useMemo(() => {
    const total = milestones.length;
    const reached = milestones.filter((milestone) => getDerivedMilestoneStatus(milestone, tasks, sprints) === "REACHED").length;
    const delayed = milestones.filter((milestone) => isMilestoneDelayed(milestone, tasks, sprints)).length;
    const upcoming = milestones.filter((milestone) => isMilestoneUpcoming(milestone)).length;
    const progress = getProjectWorkflowCompletionPercent(milestones, sprints, tasks);
    return { total, reached, delayed, upcoming, progress };
  }, [milestones, sprints, tasks]);

  const milestoneCards = useMemo(() => {
    const search = milestoneSearch.trim().toLowerCase();
    return sortMilestonesByDate(milestones).filter((milestone) => {
      const status = getDerivedMilestoneStatus(milestone, tasks, sprints);
      const sprintCount = getMilestoneSprintCount(milestone, sprints);
      const matchesSearch =
        !search ||
        milestone.title.toLowerCase().includes(search) ||
        milestone.description.toLowerCase().includes(search) ||
        (milestone.ownerName ?? "").toLowerCase().includes(search) ||
        String(sprintCount).includes(search) ||
        status.toLowerCase().includes(search);
      const matchesStatus = milestoneStatusFilter === "all" || status === milestoneStatusFilter;
      const matchesDate =
        milestoneDateFilter === "all" ||
        (milestoneDateFilter === "upcoming" && isMilestoneUpcoming(milestone)) ||
        (milestoneDateFilter === "overdue" && isMilestoneDelayed(milestone, tasks, sprints)) ||
        (milestoneDateFilter === "reached" && status === "REACHED");
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [milestoneDateFilter, milestoneSearch, milestoneStatusFilter, milestones, sprints, tasks]);

  const selectedSprint = useMemo(() => {
    const explicitSelection = selectedSprintId
      ? sprints.find((sprint) => sprint.id === selectedSprintId) ?? null
      : null;
    return explicitSelection ?? sprints.find((sprint) => sprint.status === "ACTIVE") ?? sprints[0] ?? null;
  }, [selectedSprintId, sprints]);

  const activeSprintCount = useMemo(() => sprints.filter((sprint) => sprint.status === "ACTIVE").length, [sprints]);
  const hasSprintListFiltersActive =
    sprintListSearch.trim().length > 0 ||
    sprintListStatusFilter !== "all" ||
    sprintListMilestoneFilter !== "all";
  const sprintListItems = useMemo(() => {
    const search = sprintListSearch.trim().toLowerCase();

    return sortSprintsByDate(sprints).filter((sprint) => {
      const milestoneTitle =
        milestones.find((item) => item.id === sprint.milestoneId)?.title.toLowerCase() ?? "";
      const matchesStatus =
        sprintListStatusFilter === "all" || sprint.status === sprintListStatusFilter;
      const matchesMilestone =
        sprintListMilestoneFilter === "all" || sprint.milestoneId === sprintListMilestoneFilter;

      return (
        matchesStatus &&
        matchesMilestone &&
        (
          !search ||
          sprint.name.toLowerCase().includes(search) ||
          sprint.goal.toLowerCase().includes(search) ||
          sprint.ownerName.toLowerCase().includes(search) ||
          milestoneTitle.includes(search)
        )
      );
    });
  }, [milestones, sprintListMilestoneFilter, sprintListSearch, sprintListStatusFilter, sprints]);
  const sprintMilestoneOptions = sortMilestonesByDate(milestones).map((milestone) => ({
    id: milestone.id,
    title: milestone.title,
  }));
  const selectedSprintDraftMilestone =
    milestones.find((milestone) => milestone.id === sprintDraft.milestoneId) ?? null;

  const resetSprintListFilters = () => {
    setSprintListSearch("");
    setSprintListStatusFilter("all");
    setSprintListMilestoneFilter("all");
  };

  const saveMilestoneLinks = () => {
    if (!milestoneDialogId) return;
    const nextMilestones = milestones.map((milestone) =>
      milestone.id === milestoneDialogId
        ? {
            ...milestone,
            taskLinks: Object.entries(milestoneTaskDraft)
              .filter(([, state]) => state.included)
              .map(([taskId, state]) => ({ taskId, required: state.required })),
            updatedAt: new Date().toISOString(),
          }
        : milestone
    );
    setMilestoneDialogOpen(false);
    setMilestoneDialogId(null);
    setMilestoneTaskDraft({});
    persistMilestones(nextMilestones);
  };

  const openMilestonePage = (milestone: ProjectMilestone) => {
    router.push(`/projects/${projectId}/milestones/${milestone.id}`);
  };

  const resolveMilestoneDraftPayload = (draft: MilestoneDraftState) => {
    if (!draft.title.trim()) {
      toast.error("Milestone title is required");
      return null;
    }

    const startDate = new Date(draft.startDate);
    const targetDate = new Date(draft.targetDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(targetDate.getTime()) ||
      isAfter(startDate, targetDate)
    ) {
      toast.error("Milestone dates are invalid");
      return null;
    }

    if (
      projectWindow.start &&
      !Number.isNaN(projectWindow.start.getTime()) &&
      isBefore(startDate, projectWindow.start)
    ) {
      toast.error("Milestone cannot start before the project");
      return null;
    }

    if (
      projectWindow.end &&
      !Number.isNaN(projectWindow.end.getTime()) &&
      isAfter(targetDate, projectWindow.end)
    ) {
      toast.error("Milestone must stay inside the project deadline");
      return null;
    }

    const owner =
      draft.ownerId !== "unassigned" ? teamMemberMap.get(draft.ownerId) ?? null : null;

    return {
      title: draft.title.trim(),
      description: draft.description.trim(),
      startDate: startDate.toISOString(),
      targetDate: targetDate.toISOString(),
      status: draft.status,
      owner,
    };
  };

  const openMilestoneEditor = (milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setMilestoneEditorDraft(makeMilestoneDraftFromMilestone(milestone));
    setMilestoneEditorOpen(true);
  };

  const handleUpdateMilestone = () => {
    if (!editingMilestoneId) {
      return;
    }

    const payload = resolveMilestoneDraftPayload(milestoneEditorDraft);
    if (!payload) {
      return;
    }

    const nextMilestones = milestones.map((milestone) =>
      milestone.id === editingMilestoneId
        ? {
            ...milestone,
            title: payload.title,
            description: payload.description,
            startDate: payload.startDate,
            targetDate: payload.targetDate,
            status: payload.status,
            ownerId: payload.owner?.id,
            ownerName: payload.owner?.name,
            updatedAt: new Date().toISOString(),
          }
        : milestone
    );

    setMilestoneEditorOpen(false);
    setEditingMilestoneId(null);
    persistMilestones(nextMilestones);
  };

  const handleDuplicateMilestone = (milestone: ProjectMilestone) => {
    const now = new Date().toISOString();
    const duplicate: ProjectMilestone = {
      ...milestone,
      id: crypto.randomUUID(),
      title: `${milestone.title} Copy`,
      status: "NOT_STARTED",
      taskLinks: [],
      createdAt: now,
      updatedAt: now,
    };

    persistMilestones([duplicate, ...milestones]);
    toast.success("Milestone duplicated");
  };

  const handleDeleteMilestone = (milestone: ProjectMilestone) => {
    if (getMilestoneSprintCount(milestone, sprints) > 0) {
      toast.error("Delete the related sprints first");
      return;
    }

    persistMilestones(milestones.filter((item) => item.id !== milestone.id));
  };

  const resetMilestoneFilters = () => {
    setMilestoneSearch("");
    setMilestoneStatusFilter("all");
    setMilestoneDateFilter("all");
  };

  const renderMilestoneActions = (milestone: ProjectMilestone) => {
    if (!canManage) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openMilestoneEditor(milestone)}>
            <PenSquare className="mr-2 h-4 w-4" />
            Edit milestone
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDuplicateMilestone(milestone)}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openMilestonePage(milestone)}>
            <Target className="mr-2 h-4 w-4" />
            Link tasks
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDeleteMilestone(milestone)} className="text-rose-600 focus:text-rose-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const toggleSprintTeamMember = (memberId: string, checked: boolean) => {
    setSprintDraft((current) => ({
      ...current,
      teamMemberIds: checked
        ? Array.from(new Set([...current.teamMemberIds, memberId]))
        : current.teamMemberIds.filter((id) => id !== memberId),
    }));
  };

  const handleCreateMilestone = () => {
    if (!canCreateSharedMilestones) {
      toast.error("Milestones cannot be created until a project is available");
      return;
    }

    const payload = resolveMilestoneDraftPayload(milestoneDraft);
    if (!payload) {
      return;
    }

    const now = new Date().toISOString();
    const nextMilestone: ProjectMilestone = {
      id: crypto.randomUUID(),
      title: payload.title,
      description: payload.description,
      startDate: payload.startDate,
      targetDate: payload.targetDate,
      status: payload.status,
      ownerId: payload.owner?.id,
      ownerName: payload.owner?.name,
      taskLinks: [],
      createdAt: now,
      updatedAt: now,
    };

    setCreateMilestoneDialogOpen(false);
    if (isCreateMilestoneFocusActive) {
      clearFocusQueryParam();
    }
    setMilestoneDraft(makeMilestoneDraft());
    persistMilestones([nextMilestone, ...milestones]);
  };

  const handleSprintMilestoneChange = (milestoneId: string) => {
    setSprintDraft((current) => ({ ...current, milestoneId }));
  };

  const handleCreateSprint = () => {
    if (!sprintDraft.name.trim()) {
      toast.error("Sprint name is required");
      return;
    }
    if (!sprintDraft.milestoneId) {
      toast.error("Select a milestone for this sprint");
      return;
    }
    const startDate = new Date(sprintDraft.startDate);
    const endDate = new Date(sprintDraft.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || isAfter(startDate, endDate)) {
      toast.error("Sprint dates are invalid");
      return;
    }
    const selectedMilestoneForSprint = milestones.find((milestone) => milestone.id === sprintDraft.milestoneId);
    if (!selectedMilestoneForSprint) {
      toast.error("Select a valid milestone");
      return;
    }
    if (!isSprintWithinMilestoneWindow({ startDate: sprintDraft.startDate, endDate: sprintDraft.endDate }, selectedMilestoneForSprint)) {
      toast.error("Sprint must stay inside the milestone date range");
      return;
    }
    if (sprintDraft.status === "ACTIVE" && activeSprintCount > 0) {
      toast.error("Only one sprint can be active at a time");
      return;
    }
    if (sprintDraft.teamMemberIds.length === 0) {
      toast.error("Select at least one sprint team member");
      return;
    }

    const now = new Date().toISOString();
    const owner =
      sprintDraft.ownerId !== "unassigned" ? teamMemberMap.get(sprintDraft.ownerId) ?? null : null;
    const nextTeamMemberIds = Array.from(
      new Set(
        owner?.id
          ? [...sprintDraft.teamMemberIds, owner.id]
          : sprintDraft.teamMemberIds
      )
    );
    const nextSprint: ProjectSprint = {
      id: crypto.randomUUID(),
      name: sprintDraft.name.trim(),
      goal: sprintDraft.goal.trim(),
      milestoneId: sprintDraft.milestoneId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: sprintDraft.status,
      ownerId: owner?.id,
      ownerName: owner?.name || sprintDraft.ownerName.trim() || "Unassigned",
      teamMemberIds: nextTeamMemberIds,
      taskAssignments: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    setCreateSprintDialogOpen(false);
    if (isCreateSprintFocusActive) {
      clearFocusQueryParam();
    }
    setSprintDraft(makeSprintDraft());
    persistSprints([nextSprint, ...sprints]);
    setSelectedSprintId(nextSprint.id);
  };

  const currentMilestone = milestoneDialogId
    ? milestones.find((milestone) => milestone.id === milestoneDialogId) ?? null
    : null;

  if (isLoading) {
    return <div className="rounded-xl border border-dashed p-6 text-sm text-slate-500">Loading workflow...</div>;
  }

  return (
    <div className="space-y-6 px-4 py-6 md:px-6">
      {section === "milestones" ? (
        <div className="space-y-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Milestones</h1>
              <p className="mt-2 text-sm text-slate-600">Track and manage your project milestones.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canManage && canCreateSharedMilestones ? (
                <Button type="button" className="h-11 rounded-lg px-5 text-sm font-semibold" onClick={() => setCreateMilestoneDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Milestone
                </Button>
              ) : null}
              <Button type="button" variant="outline" className="h-11 rounded-lg px-5 text-sm font-semibold" onClick={refreshState}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[156px] flex-col justify-between p-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <ClipboardList className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Total Milestones</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold leading-none text-slate-950">{milestoneSummary.total}</p>
                  <p className="mt-6 text-sm text-slate-500">All milestones</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[156px] flex-col justify-between p-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Reached</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold leading-none text-slate-950">{milestoneSummary.reached}</p>
                  <p className="mt-6 text-sm text-slate-500">
                    {milestoneSummary.total === 0 ? 0 : Math.round((milestoneSummary.reached / milestoneSummary.total) * 100)}% of total
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[156px] flex-col justify-between p-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Clock3 className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Delayed</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold leading-none text-slate-950">{milestoneSummary.delayed}</p>
                  <p className="mt-6 text-sm text-slate-500">
                    {milestoneSummary.total === 0 ? 0 : Math.round((milestoneSummary.delayed / milestoneSummary.total) * 100)}% of total
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[156px] flex-col justify-between p-6">
                <div className="flex items-center gap-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                    <CalendarDays className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">Upcoming</p>
                </div>
                <div>
                  <p className="text-4xl font-semibold leading-none text-slate-950">{milestoneSummary.upcoming}</p>
                  <p className="mt-6 text-sm text-slate-500">
                    {milestoneSummary.total === 0 ? 0 : Math.round((milestoneSummary.upcoming / milestoneSummary.total) * 100)}% of total
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardContent className="flex min-h-[156px] flex-col justify-between p-6">
                <p className="text-sm font-semibold text-slate-950">Workflow Progress</p>
                <div>
                  <p className="text-4xl font-semibold leading-none text-slate-950">{milestoneSummary.progress}%</p>
                  <Progress value={milestoneSummary.progress} className="mt-5 h-2 bg-slate-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative w-full sm:w-[280px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input className="h-11 pl-11" value={milestoneSearch} onChange={(e) => setMilestoneSearch(e.target.value)} placeholder="Search milestones..." />
            </div>
            <Select value={milestoneStatusFilter} onValueChange={(value) => setMilestoneStatusFilter(value as MilestoneStatus | "all")}>
              <SelectTrigger className="h-11 w-full sm:w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {MILESTONE_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={milestoneDateFilter} onValueChange={(value) => setMilestoneDateFilter(value as typeof milestoneDateFilter)}>
              <SelectTrigger className="h-11 w-full sm:w-[160px]"><SelectValue placeholder="Target date" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="overdue">Delayed</SelectItem>
                <SelectItem value="reached">Reached</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              {hasMilestoneFiltersActive ? (
                <Button type="button" variant="outline" className="h-11 rounded-lg px-4 text-sm font-semibold" onClick={resetMilestoneFilters}>
                  <FilterX className="mr-2 h-4 w-4" />
                  Reset filters
                </Button>
              ) : null}
            </div>
          </div>

          {milestoneCards.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <p className="text-base font-semibold text-slate-900">
                  {milestones.length === 0 ? "No milestones created yet" : "No milestones match the current filters"}
                </p>
                <p className="text-sm text-slate-500">
                  {milestones.length === 0
                    ? "Use Create Shared Milestone to add the first major delivery phase for all projects."
                    : "Try clearing the search or filter options to see more milestones."}
                </p>
                {hasMilestoneFiltersActive ? (
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" onClick={resetMilestoneFilters}>
                      <FilterX className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  </div>
                ) : canManage && canCreateSharedMilestones ? (
                  <div className="flex justify-center">
                    <Button type="button" onClick={() => setCreateMilestoneDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Shared Milestone
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Deadline</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Progress</th>
                      <th className="px-6 py-4">Work</th>
                      <th className="px-6 py-4">Owner</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {milestoneCards.map((milestone) => {
                      const completion = getMilestoneCompletionPercent(milestone, tasks, sprints);
                      const derivedStatus = getDerivedMilestoneStatus(milestone, tasks, sprints);
                      const sprintCount = getMilestoneSprintCount(milestone, sprints);
                      const completedSprints = getMilestoneCompletedSprintCount(milestone, sprints, tasks);
                      const pendingSprints = getMilestonePendingSprintCount(milestone, sprints, tasks);
                      const linkedTaskCount = getMilestoneTaskCount(milestone, sprints);

                      return (
                        <tr
                          key={milestone.id}
                          className="align-top hover:bg-slate-50/70"
                          onClick={() => openMilestonePage(milestone)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openMilestonePage(milestone);
                            }
                          }}
                        >
                          <td className="px-6 py-7">
                            <div className="min-w-[220px]">
                              <p className="font-semibold text-slate-900">{milestone.title}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {milestone.description || "No description"}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-7">
                            <div className="min-w-[150px] text-slate-700">
                              <p>{format(new Date(milestone.targetDate), "dd MMM yyyy")}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Start: {format(new Date(milestone.startDate), "dd MMM yyyy")}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-7">
                            <Badge>{getMilestoneStatusLabel(derivedStatus)}</Badge>
                          </td>
                          <td className="px-6 py-7">
                            <div className="min-w-[190px] space-y-4">
                              <p className="font-medium text-slate-900">{completion}%</p>
                              <Progress value={completion} className="h-2 bg-slate-200" />
                            </div>
                          </td>
                          <td className="px-6 py-7">
                            <div className="min-w-[140px] text-slate-700">
                              <p>{linkedTaskCount} linked tasks</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {completedSprints}/{sprintCount} complete, {pendingSprints} pending
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-7">
                            <span className="text-slate-700">
                              {milestone.ownerName || "Unassigned owner"}
                            </span>
                          </td>
                          <td className="px-6 py-7">
                            <div className="flex justify-end gap-2">
                              {canManage ? (
                                <>
                                  {renderMilestoneActions(milestone)}
                                </>
                              ) : (
                                <span className="text-xs text-slate-400">No actions</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-5 text-sm text-slate-700">
                <span>
                  Showing 1 to {milestoneCards.length} of {milestoneCards.length} milestones
                </span>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" className="h-9 w-9">
                    1
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" disabled>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-500" />
              <Input className="w-[220px]" value={sprintListSearch} onChange={(e) => setSprintListSearch(e.target.value)} placeholder="Search sprints" />
            </div>
            <Select value={sprintListStatusFilter} onValueChange={(value) => setSprintListStatusFilter(value as SprintStatus | "all")}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {SPRINT_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sprintListMilestoneFilter} onValueChange={setSprintListMilestoneFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Milestone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Milestones</SelectItem>
                {sprintMilestoneOptions.map((milestone) => <SelectItem key={milestone.id} value={milestone.id}>{milestone.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-2">
              {canManage ? (
                <Button type="button" size="sm" onClick={() => setCreateSprintDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sprint
                </Button>
              ) : null}
              {hasSprintListFiltersActive ? (
                <Button type="button" variant="outline" size="sm" onClick={resetSprintListFilters}>
                  <FilterX className="mr-2 h-4 w-4" />
                  Reset filters
                </Button>
              ) : null}
              <Button type="button" variant="ghost" size="sm" onClick={refreshState}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>

          {sprintListItems.length === 0 ? (
            <Card>
              <CardContent className="space-y-3 py-10 text-center">
                <p className="text-base font-semibold text-slate-900">
                  {sprints.length === 0 ? "No sprints created yet" : "No sprints match the current filters"}
                </p>
                <p className="text-sm text-slate-500">
                  {sprints.length === 0
                    ? "Use Create Sprint to plan the first sprint inside a milestone."
                    : "Try clearing the search or filter options to see more sprints."}
                </p>
                {hasSprintListFiltersActive ? (
                  <div className="flex justify-center">
                    <Button type="button" variant="outline" onClick={resetSprintListFilters}>
                      <FilterX className="mr-2 h-4 w-4" />
                      Clear filters
                    </Button>
                  </div>
                ) : canManage ? (
                  <div className="flex justify-center">
                    <Button type="button" onClick={() => setCreateSprintDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Sprint
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Window</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Work</th>
                      <th className="px-4 py-3">Owner</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sprintListItems.map((sprint) => {
                      const progress = getSprintProgressPercent(sprint, tasks);
                      const completedTasks = getSprintCompletedTaskCount(sprint, tasks);
                      const pendingTasks = getSprintPendingTaskCount(sprint, tasks);
                      const overdue = isSprintOverdue(sprint, tasks);
                      const selected = selectedSprint?.id === sprint.id;
                      const milestone = milestones.find((item) => item.id === sprint.milestoneId) ?? null;

                      return (
                        <tr key={sprint.id} className={selected ? "bg-sky-50/70" : undefined}>
                          <td className="px-4 py-4">
                            <div className="min-w-[220px]">
                              <p className="font-semibold text-slate-900">{sprint.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {sprint.goal || "No sprint goal provided"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[180px] text-slate-700">
                              <p>{getSprintDeadlineLabel(sprint)}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Start: {format(new Date(sprint.startDate), "dd MMM yyyy")}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex min-w-[140px] flex-wrap gap-2">
                              <Badge variant="secondary" className={sprint.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : overdue ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"}>
                                {sprint.status.replace("_", " ")}
                              </Badge>
                              {milestone ? <Badge variant="outline">{milestone.title}</Badge> : null}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[150px] space-y-2">
                              <p className="font-medium text-slate-900">{progress}%</p>
                              <Progress value={progress} className="h-2" />
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[160px] text-slate-700">
                              <p>{sprint.taskAssignments.length} tasks tracked</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {completedTasks} completed, {pendingTasks} pending
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="min-w-[140px] text-slate-700">
                              <p>{sprint.ownerName || "Unassigned owner"}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {sprint.teamMemberIds.length} team members
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              {canManage ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Open sprint actions</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        persistSprints(
                                          sprints.map((item) =>
                                            item.id === sprint.id
                                              ? {
                                                  ...item,
                                                  status: item.status === "ACTIVE" ? "PLANNED" : "ACTIVE",
                                                  updatedAt: new Date().toISOString(),
                                                }
                                              : item
                                          )
                                        );
                                      }}
                                    >
                                      {sprint.status === "ACTIVE" ? "Pause" : "Activate"}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        persistSprints(
                                          sprints.map((item) =>
                                            item.id === sprint.id
                                              ? {
                                                  ...item,
                                                  status: "COMPLETED",
                                                  completedAt: new Date().toISOString(),
                                                  updatedAt: new Date().toISOString(),
                                                }
                                              : item
                                          )
                                        );
                                      }}
                                    >
                                      Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-rose-600 focus:text-rose-600"
                                      onClick={() => {
                                        persistSprints(sprints.filter((item) => item.id !== sprint.id));
                                      }}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      )}

      <Dialog open={isCreateMilestonePanelOpen} onOpenChange={handleCreateMilestoneDialogOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Shared Milestone</DialogTitle>
            <DialogDescription>
              Add a milestone that will be available to every project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="milestone-title">Milestone Title</Label>
              <Input id="milestone-title" value={milestoneDraft.title} onChange={(e) => setMilestoneDraft((cur) => ({ ...cur, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={milestoneDraft.ownerId} onValueChange={(value) => setMilestoneDraft((cur) => ({ ...cur, ownerId: value }))}>
                <SelectTrigger><SelectValue placeholder="Milestone owner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-start-date">Start Date</Label>
              <Input
                id="milestone-start-date"
                type="date"
                min={projectWindow.start ? format(projectWindow.start, "yyyy-MM-dd") : undefined}
                max={milestoneDraft.targetDate}
                value={milestoneDraft.startDate}
                onChange={(e) => setMilestoneDraft((cur) => ({ ...cur, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-date">Target Date</Label>
              <Input
                id="milestone-date"
                type="date"
                min={milestoneDraft.startDate}
                max={projectWindow.end ? format(projectWindow.end, "yyyy-MM-dd") : undefined}
                value={milestoneDraft.targetDate}
                onChange={(e) => setMilestoneDraft((cur) => ({ ...cur, targetDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-description">Description</Label>
              <Textarea id="milestone-description" value={milestoneDraft.description} onChange={(e) => setMilestoneDraft((cur) => ({ ...cur, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={milestoneDraft.status} onValueChange={(value) => setMilestoneDraft((cur) => ({ ...cur, status: value as MilestoneStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MILESTONE_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleCreateMilestoneDialogOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCreateMilestone} disabled={isPending || isSavingMilestones}>
                <Plus className="mr-2 h-4 w-4" />
                Add Milestone
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateSprintPanelOpen} onOpenChange={handleCreateSprintDialogOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Sprint</DialogTitle>
            <DialogDescription>
              Add a sprint after reviewing the current sprint list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sprint-name">Sprint Name</Label>
              <Input id="sprint-name" value={sprintDraft.name} onChange={(e) => setSprintDraft((cur) => ({ ...cur, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Milestone</Label>
              <Select value={sprintDraft.milestoneId} onValueChange={handleSprintMilestoneChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select milestone" />
                </SelectTrigger>
                <SelectContent>
                  {sprintMilestoneOptions.map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="sprint-goal">Sprint Goal</Label>
              <Textarea id="sprint-goal" value={sprintDraft.goal} onChange={(e) => setSprintDraft((cur) => ({ ...cur, goal: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-start">Start Date</Label>
              <Input
                id="sprint-start"
                type="date"
                min={
                  selectedSprintDraftMilestone
                    ? formatWorkflowDateInput(selectedSprintDraftMilestone.startDate)
                    : projectWindow.start
                      ? format(projectWindow.start, "yyyy-MM-dd")
                      : undefined
                }
                max={
                  selectedSprintDraftMilestone
                    ? formatWorkflowDateInput(selectedSprintDraftMilestone.targetDate)
                    : projectWindow.end
                      ? format(projectWindow.end, "yyyy-MM-dd")
                      : undefined
                }
                value={sprintDraft.startDate}
                onChange={(e) => setSprintDraft((cur) => ({ ...cur, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-end">End Date</Label>
              <Input
                id="sprint-end"
                type="date"
                min={sprintDraft.startDate}
                max={
                  selectedSprintDraftMilestone
                    ? formatWorkflowDateInput(selectedSprintDraftMilestone.targetDate)
                    : projectWindow.end
                      ? format(projectWindow.end, "yyyy-MM-dd")
                      : undefined
                }
                value={sprintDraft.endDate}
                onChange={(e) => setSprintDraft((cur) => ({ ...cur, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner / Scrum Lead</Label>
              <Select value={sprintDraft.ownerId} onValueChange={(value) => setSprintDraft((cur) => ({ ...cur, ownerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sprint owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={sprintDraft.status} onValueChange={(value) => setSprintDraft((cur) => ({ ...cur, status: value as SprintStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SPRINT_STATUS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Sprint Team</Label>
                <Badge variant="secondary">{sprintDraft.teamMemberIds.length} selected</Badge>
              </div>
              {teamMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  Add project team members before creating a sprint team.
                </div>
              ) : (
                <div className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2 xl:grid-cols-3">
                  {teamMembers.map((member) => {
                    const checked = sprintDraft.teamMemberIds.includes(member.id);
                    return (
                      <label key={member.id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(value) => toggleSprintTeamMember(member.id, value === true)} />
                        <span className="min-w-0">
                          <span className="block font-medium text-slate-900">{member.name}</span>
                          <span className="block text-xs text-slate-500">{member.role || "Team member"}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 lg:col-span-2">
              Every sprint must stay inside the milestone date range.
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleCreateSprintDialogOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateSprint} disabled={isPending || isSavingSprints}>
              <Plus className="mr-2 h-4 w-4" />
              Add Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={milestoneEditorOpen}
        onOpenChange={(open) => {
          setMilestoneEditorOpen(open);
          if (!open) {
            setEditingMilestoneId(null);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>Update milestone scope, timeline, owner, and delivery status.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="milestone-editor-title">Milestone Title</Label>
              <Input
                id="milestone-editor-title"
                value={milestoneEditorDraft.title}
                onChange={(event) => setMilestoneEditorDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={milestoneEditorDraft.ownerId} onValueChange={(value) => setMilestoneEditorDraft((current) => ({ ...current, ownerId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Milestone owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-editor-start-date">Start Date</Label>
              <Input
                id="milestone-editor-start-date"
                type="date"
                value={milestoneEditorDraft.startDate}
                onChange={(event) => setMilestoneEditorDraft((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-editor-target-date">Target Date</Label>
              <Input
                id="milestone-editor-target-date"
                type="date"
                value={milestoneEditorDraft.targetDate}
                onChange={(event) => setMilestoneEditorDraft((current) => ({ ...current, targetDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-editor-description">Description</Label>
              <Textarea
                id="milestone-editor-description"
                value={milestoneEditorDraft.description}
                onChange={(event) => setMilestoneEditorDraft((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={milestoneEditorDraft.status} onValueChange={(value) => setMilestoneEditorDraft((current) => ({ ...current, status: value as MilestoneStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setMilestoneEditorOpen(false);
                setEditingMilestoneId(null);
              }}>
                Cancel
              </Button>
              <Button type="button" onClick={handleUpdateMilestone} disabled={isPending || isSavingMilestones}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={milestoneDialogOpen} onOpenChange={setMilestoneDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-hidden p-0">
          {currentMilestone ? (
            <div className="flex max-h-[88vh] flex-col">
              <div className="border-b border-slate-200 px-6 py-5">
                <DialogHeader className="space-y-2">
                  <DialogTitle>Link Tasks to Milestone</DialogTitle>
                  <DialogDescription>Choose the tasks that support this milestone and mark mandatory items.</DialogDescription>
                </DialogHeader>
              </div>
              <div className="space-y-4 px-6 py-5">
                <Card className="border-slate-200 bg-slate-50 shadow-none">
                  <CardContent className="space-y-1 p-4">
                    <p className="text-lg font-semibold text-slate-900">{currentMilestone.title}</p>
                    <p className="text-sm text-slate-500">{currentMilestone.description || "No description"}</p>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-slate-200 shadow-none">
                  <ScrollArea className="h-[340px]">
                    <div className="space-y-2 p-4">
                      {tasks.map((task) => {
                        const state = milestoneTaskDraft[task.id] ?? { included: false, required: false };
                        const taskMilestoneId = getTaskMilestoneId(task.id, milestones, sprints);
                        const conflictingMilestone =
                          taskMilestoneId && taskMilestoneId !== currentMilestone.id
                            ? milestones.find((milestone) => milestone.id === taskMilestoneId) ?? null
                            : null;
                        return (
                          <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={state.included}
                                disabled={Boolean(conflictingMilestone)}
                                onCheckedChange={(checked) =>
                                  setMilestoneTaskDraft((current) => ({
                                    ...current,
                                    [task.id]: {
                                      included: checked === true,
                                      required: checked === true ? current[task.id]?.required ?? false : false,
                                    },
                                  }))
                                }
                              />
                              <div>
                                <p className="text-sm font-medium text-slate-900">{task.title}</p>
                                <p className="text-xs text-slate-500">{getTaskAssigneeDisplay(task)}</p>
                                {conflictingMilestone ? (
                                  <p className="text-xs text-amber-700">
                                    Already linked to {conflictingMilestone.title}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-600">
                              <Checkbox
                                checked={state.required}
                                disabled={!state.included || Boolean(conflictingMilestone)}
                                onCheckedChange={(checked) =>
                                  setMilestoneTaskDraft((current) => ({
                                    ...current,
                                    [task.id]: {
                                      included: true,
                                      required: checked === true,
                                    },
                                  }))
                                }
                              />
                              Required
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </Card>
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <Button type="button" variant="outline" onClick={() => setMilestoneDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveMilestoneLinks} disabled={isPending || isSavingMilestones}>
                    Save Links
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
