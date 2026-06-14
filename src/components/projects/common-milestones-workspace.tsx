"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, isAfter, isValid, parseISO } from "date-fns";
import {
  Copy,
  FilterX,
  MoreHorizontal,
  PenSquare,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getCommonMilestonesState, saveCommonMilestones } from "@/actions/project-workflow.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MilestoneStatus, ProjectMilestone } from "@/lib/project-workflow-types";
import {
  getDerivedMilestoneStatus,
  getMilestoneCompletionPercent,
  getMilestoneStatusLabel,
  isMilestoneDelayed,
  isMilestoneUpcoming,
  sortMilestonesByDate,
} from "@/lib/project-workflow-utils";

interface CommonMilestonesWorkspaceProps {
  canManage: boolean;
}

type MilestoneDraft = {
  title: string;
  description: string;
  startDate: string;
  targetDate: string;
  status: MilestoneStatus;
};

function createEmptyDraft(): MilestoneDraft {
  const today = new Date().toISOString().slice(0, 10);
  return {
    title: "",
    description: "",
    startDate: today,
    targetDate: today,
    status: "NOT_STARTED",
  };
}

function formatDateInput(value: string) {
  const parsed = parseISO(value);
  return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
}

export function CommonMilestonesWorkspace({ canManage }: CommonMilestonesWorkspaceProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MilestoneStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "upcoming" | "overdue" | "reached">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [draft, setDraft] = useState<MilestoneDraft>(() => createEmptyDraft());

  useEffect(() => {
    let active = true;

    getCommonMilestonesState().then((result) => {
      if (!active) {
        return;
      }

      if (result.error) {
        toast.error(result.error);
      }

      setMilestones(result.milestones ?? []);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const milestoneSummary = useMemo(() => {
    const total = milestones.length;
    const reached = milestones.filter((milestone) => getDerivedMilestoneStatus(milestone, [], []) === "REACHED").length;
    const delayed = milestones.filter((milestone) => isMilestoneDelayed(milestone, [], [])).length;
    const upcoming = milestones.filter((milestone) => isMilestoneUpcoming(milestone)).length;
    const progress = total === 0 ? 0 : Math.round(milestones.reduce((sum, milestone) => sum + getMilestoneCompletionPercent(milestone, [], []), 0) / total);
    return { total, reached, delayed, upcoming, progress };
  }, [milestones]);

  const filteredMilestones = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortMilestonesByDate(milestones).filter((milestone) => {
      const status = getDerivedMilestoneStatus(milestone, [], []);
      const matchesSearch =
        !query ||
        milestone.title.toLowerCase().includes(query) ||
        milestone.description.toLowerCase().includes(query) ||
        (milestone.ownerName ?? "").toLowerCase().includes(query) ||
        status.toLowerCase().includes(query);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      const matchesDate =
        dateFilter === "all" ||
        (dateFilter === "upcoming" && isMilestoneUpcoming(milestone)) ||
        (dateFilter === "overdue" && isMilestoneDelayed(milestone, [], [])) ||
        (dateFilter === "reached" && status === "REACHED");
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [dateFilter, milestones, search, statusFilter]);

  const hasFiltersActive =
    search.trim().length > 0 || statusFilter !== "all" || dateFilter !== "all";

  const openCreateDialog = () => {
    if (!canManage) {
      return;
    }

    setEditingMilestoneId(null);
    setDraft(createEmptyDraft());
    setCreateOpen(true);
  };

  const openEditDialog = (milestone: ProjectMilestone) => {
    setEditingMilestoneId(milestone.id);
    setDraft({
      title: milestone.title,
      description: milestone.description,
      startDate: formatDateInput(milestone.startDate),
      targetDate: formatDateInput(milestone.targetDate),
      status: milestone.status,
    });
    setCreateOpen(true);
  };

  const persistMilestones = (nextMilestones: ProjectMilestone[]) => {
    setIsSaving(true);
    const formData = new FormData();
    formData.set("milestones", JSON.stringify(nextMilestones));

    startTransition(async () => {
      const result = await saveCommonMilestones(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setMilestones(result.milestones ?? nextMilestones);
        toast.success("Milestones updated");
      }
      setIsSaving(false);
    });
  };

  const handleSaveMilestone = () => {
    if (!canManage) {
      toast.error("You do not have permission to manage milestones");
      return;
    }

    const title = draft.title.trim();
    if (!title) {
      toast.error("Milestone title is required");
      return;
    }

    const startDate = new Date(draft.startDate);
    const targetDate = new Date(draft.targetDate);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(targetDate.getTime()) ||
      isAfter(startDate, targetDate)
    ) {
      toast.error("Milestone dates are invalid");
      return;
    }

    const now = new Date().toISOString();
    const updatedMilestone: ProjectMilestone = {
      id: editingMilestoneId ?? crypto.randomUUID(),
      title,
      description: draft.description.trim(),
      startDate: startDate.toISOString(),
      targetDate: targetDate.toISOString(),
      status: draft.status,
      taskLinks: editingMilestoneId
        ? milestones.find((milestone) => milestone.id === editingMilestoneId)?.taskLinks ?? []
        : [],
      createdAt:
        editingMilestoneId
          ? milestones.find((milestone) => milestone.id === editingMilestoneId)?.createdAt ?? now
          : now,
      updatedAt: now,
    };

    const nextMilestones = editingMilestoneId
      ? milestones.map((milestone) => (milestone.id === editingMilestoneId ? updatedMilestone : milestone))
      : [updatedMilestone, ...milestones];

    setCreateOpen(false);
    setEditingMilestoneId(null);
    persistMilestones(nextMilestones);
  };

  const handleDuplicate = (milestone: ProjectMilestone) => {
    const now = new Date().toISOString();
    const duplicate: ProjectMilestone = {
      ...milestone,
      id: crypto.randomUUID(),
      title: `${milestone.title} Copy`,
      status: "NOT_STARTED",
      createdAt: now,
      updatedAt: now,
    };
    persistMilestones([duplicate, ...milestones]);
  };

  const handleDelete = (milestoneId: string) => {
    persistMilestones(milestones.filter((milestone) => milestone.id !== milestoneId));
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setDateFilter("all");
  };

  if (isLoading) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-sm text-slate-500">Loading common milestones...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-900">Total Milestones</p><p className="mt-10 text-3xl font-semibold text-slate-950">{milestoneSummary.total}</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-900">Reached</p><p className="mt-10 text-3xl font-semibold text-slate-950">{milestoneSummary.reached}</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-900">Delayed</p><p className="mt-10 text-3xl font-semibold text-slate-950">{milestoneSummary.delayed}</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-900">Upcoming</p><p className="mt-10 text-3xl font-semibold text-slate-950">{milestoneSummary.upcoming}</p></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-900">Workflow Progress</p><p className="mt-10 text-3xl font-semibold text-slate-950">{milestoneSummary.progress}%</p><Progress value={milestoneSummary.progress} className="mt-4 h-2" /></CardContent></Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          <Input className="w-[220px]" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search milestones" />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MilestoneStatus | "all")}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="REACHED">Reached</SelectItem>
            <SelectItem value="DELAYED">Delayed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as typeof dateFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Target date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="overdue">Delayed</SelectItem>
            <SelectItem value="reached">Reached</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {canManage ? (
            <Button type="button" size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Create Shared Milestone
            </Button>
          ) : null}
          {hasFiltersActive ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              <FilterX className="mr-2 h-4 w-4" />
              Reset filters
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              getCommonMilestonesState().then((result) => {
                if (result.error) {
                  toast.error(result.error);
                } else {
                  setMilestones(result.milestones ?? []);
                }
                setIsLoading(false);
              });
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Work</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredMilestones.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-sm text-slate-500" colSpan={7}>
                    {milestones.length === 0 ? "No milestones created yet" : "No milestones match the current filters"}
                  </td>
                </tr>
              ) : (
                filteredMilestones.map((milestone) => {
                  const completion = getMilestoneCompletionPercent(milestone, [], []);
                  const derivedStatus = getDerivedMilestoneStatus(milestone, [], []);

                  return (
                    <tr key={milestone.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <div className="min-w-[220px]">
                          <p className="font-semibold text-slate-900">{milestone.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{milestone.description || "No description"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[150px] text-slate-700">
                          <p>{format(new Date(milestone.targetDate), "dd MMM yyyy")}</p>
                          <p className="mt-1 text-xs text-slate-500">Start: {format(new Date(milestone.startDate), "dd MMM yyyy")}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge>{getMilestoneStatusLabel(derivedStatus)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[150px] space-y-2">
                          <p className="font-medium text-slate-900">{completion}%</p>
                          <Progress value={completion} className="h-2" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[140px] text-slate-700">
                          <p>0 linked tasks</p>
                          <p className="mt-1 text-xs text-slate-500">0/0 complete, 0 pending</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-slate-700">Unassigned</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(milestone)}>
                                  <PenSquare className="mr-2 h-4 w-4" />
                                  Edit milestone
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicate(milestone)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-rose-600 focus:text-rose-600"
                                  onClick={() => handleDelete(milestone.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => setCreateOpen(open)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMilestoneId ? "Edit Milestone" : "Create Shared Milestone"}</DialogTitle>
            <DialogDescription>
              {editingMilestoneId
                ? "Update this shared milestone."
                : "Create a shared milestone before any project exists."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="common-milestone-title">Title</Label>
              <Input
                id="common-milestone-title"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Milestone title"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="common-milestone-description">Description</Label>
              <Textarea
                id="common-milestone-description"
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="common-milestone-start">Start Date</Label>
              <Input
                id="common-milestone-start"
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="common-milestone-target">Target Date</Label>
              <Input
                id="common-milestone-target"
                type="date"
                value={draft.targetDate}
                onChange={(event) => setDraft((current) => ({ ...current, targetDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => setDraft((current) => ({ ...current, status: value as MilestoneStatus }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="REACHED">Reached</SelectItem>
                  <SelectItem value="DELAYED">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveMilestone} disabled={isPending || isSaving}>
              {editingMilestoneId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
