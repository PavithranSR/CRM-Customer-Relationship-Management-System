"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { ChevronDown, LayoutGrid, List, Loader2, Plus, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import { toast } from "sonner";
import {
  createTeam,
  deleteTeam,
  importLegacyTeams,
  removeEmployeeFromTeam,
  updateTeam,
} from "@/actions/team.actions";
import type { TeamListItem } from "@/lib/teams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamOverviewCard } from "@/components/teams/team-overview-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface TeamManagementProps {
  employees: EmployeeOption[];
  initialTeams: TeamListItem[];
}

type TeamFilter = "all" | "ready" | "needs-leader" | "large";

const LEGACY_STORAGE_KEY = "team-management-data-v1";

function formatRoleLabel(role: Role) {
  switch (role) {
    case "TEAMLEADER":
      return "Team Leader";
    case "EMPLOYEE":
      return "Employee";
    case "BA":
      return "BA";
    case "ADMIN":
      return "Admin";
    default:
      return role;
  }
}

function normalizeLegacyStoredTeam(
  value: unknown
): { name: string; memberIds: string[]; createdAt?: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string") {
    return null;
  }

  const memberIds = new Set<string>();

  if (Array.isArray(raw.memberIds)) {
    raw.memberIds.forEach((memberId) => {
      if (typeof memberId === "string" && memberId.trim()) {
        memberIds.add(memberId.trim());
      }
    });
  }

  if (typeof raw.leadId === "string" && raw.leadId.trim()) {
    memberIds.add(raw.leadId.trim());
  }

  if (typeof raw.baId === "string" && raw.baId.trim()) {
    memberIds.add(raw.baId.trim());
  }

  if (memberIds.size === 0) {
    return null;
  }

  return {
    name: raw.name.trim(),
    memberIds: Array.from(memberIds),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
  };
}

export function TeamManagement({ employees, initialTeams }: TeamManagementProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [teamViewMode, setTeamViewMode] = useState<"grid" | "list">("grid");
  const [teamName, setTeamName] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{
    teamId: string;
    memberId: string;
    memberName: string;
  } | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [teams, setTeams] = useState<TeamListItem[]>(initialTeams);
  const legacyImportAttemptedRef = useRef(false);
  const toolbarShellRef = useRef<HTMLDivElement | null>(null);
  const [toolbarShellHeight, setToolbarShellHeight] = useState(0);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  useEffect(() => {
    const toolbarNode = toolbarShellRef.current;

    if (!toolbarNode) {
      return;
    }

    const updateToolbarHeight = () => {
      setToolbarShellHeight(toolbarNode.getBoundingClientRect().height);
    };

    updateToolbarHeight();
    window.addEventListener("resize", updateToolbarHeight);

    if (typeof ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateToolbarHeight);
    }

    const resizeObserver = new ResizeObserver(updateToolbarHeight);
    resizeObserver.observe(toolbarNode);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateToolbarHeight);
    };
  }, []);

  useEffect(() => {
    if (legacyImportAttemptedRef.current || initialTeams.length > 0) {
      return;
    }

    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    const legacyTeams = parsed
      .map((team) => normalizeLegacyStoredTeam(team))
      .filter((team): team is { name: string; memberIds: string[]; createdAt?: string } => Boolean(team));

    if (legacyTeams.length === 0) {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return;
    }

    legacyImportAttemptedRef.current = true;

    startTransition(async () => {
      const result = await importLegacyTeams(legacyTeams);

      if ("error" in result) {
        legacyImportAttemptedRef.current = false;
        toast.error(typeof result.error === "string" ? result.error : "Unable to import existing teams");
        return;
      }

      setTeams(result.data);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);

      if (result.importedCount > 0) {
        toast.success("Existing browser teams were imported into the database");
      }
    });
  }, [initialTeams]);

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );
  const editingTeam = useMemo(
    () => teams.find((team) => team.id === editingTeamId) ?? null,
    [editingTeamId, teams]
  );

  const nonAdminEmployees = useMemo(
    () =>
      employees
        .filter((employee) => employee.role !== "ADMIN")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();

    teams.forEach((team) => {
      team.members.forEach((member) => ids.add(member.id));
    });

    return ids;
  }, [teams]);
  const editableEmployeeIds = useMemo(
    () => new Set(editingTeam?.members.map((member) => member.id) ?? []),
    [editingTeam]
  );

  const selectableEmployees = useMemo(
    () =>
      nonAdminEmployees.filter(
        (employee) =>
          memberIds.includes(employee.id) ||
          editableEmployeeIds.has(employee.id) ||
          !assignedEmployeeIds.has(employee.id)
      ),
    [assignedEmployeeIds, editableEmployeeIds, memberIds, nonAdminEmployees]
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();

    if (!query) {
      return selectableEmployees;
    }

    return selectableEmployees.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query)
    );
  }, [memberSearch, selectableEmployees]);

  const selectedMembers = useMemo(
    () => memberIds.map((id) => employeeMap.get(id)).filter((member): member is EmployeeOption => Boolean(member)),
    [employeeMap, memberIds]
  );
  const totalTeamMembers = useMemo(
    () => teams.reduce((sum, team) => sum + team.members.length, 0),
    [teams]
  );
  const totalTeamLeaders = useMemo(
    () =>
      teams.reduce(
        (sum, team) => sum + team.members.filter((member) => member.role === "TEAMLEADER").length,
        0
      ),
    [teams]
  );
  const teamsWithoutLead = useMemo(
    () => teams.filter((team) => !team.members.some((member) => member.role === "TEAMLEADER")).length,
    [teams]
  );
  const readyTeamsCount = useMemo(
    () => teams.filter((team) => team.members.some((member) => member.role === "TEAMLEADER")).length,
    [teams]
  );
  const largeTeamsCount = useMemo(
    () => teams.filter((team) => team.members.length >= 5).length,
    [teams]
  );
  const filterOptions = useMemo(
    () => [
      { value: "all" as const, label: "All", count: teams.length },
      { value: "ready" as const, label: "Ready", count: readyTeamsCount },
      { value: "needs-leader" as const, label: "Needs Leader", count: teamsWithoutLead },
      { value: "large" as const, label: "5+ Members", count: largeTeamsCount },
    ],
    [largeTeamsCount, readyTeamsCount, teams.length, teamsWithoutLead]
  );
  const activeFilterOption = useMemo(
    () => filterOptions.find((option) => option.value === teamFilter) ?? filterOptions[0],
    [filterOptions, teamFilter]
  );
  const filteredTeams = useMemo(() => {
    const query = teamSearch.trim().toLowerCase();

    return teams.filter((team) => {
      const matchesQuery =
        query.length === 0 ||
        team.name.toLowerCase().includes(query) ||
        team.members.some(
          (member) =>
            member.name.toLowerCase().includes(query) ||
            member.email.toLowerCase().includes(query)
        );

      const matchesFilter =
        teamFilter === "all" ||
        (teamFilter === "ready" &&
          team.members.some((member) => member.role === "TEAMLEADER")) ||
        (teamFilter === "needs-leader" &&
          !team.members.some((member) => member.role === "TEAMLEADER")) ||
        (teamFilter === "large" && team.members.length >= 5);

      return matchesQuery && matchesFilter;
    });
  }, [teamFilter, teamSearch, teams]);

  const toggleMember = (employeeId: string, checked: boolean) => {
    setMemberIds((current) => {
      if (checked) {
        return current.includes(employeeId) ? current : [...current, employeeId];
      }

      return current.filter((id) => id !== employeeId);
    });
  };

  const resetTeamDialogState = () => {
    setEditingTeamId(null);
    setTeamName("");
    setMemberIds([]);
    setMemberSearch("");
  };

  const handleTeamDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);

    if (!open) {
      resetTeamDialogState();
    }
  };

  const openCreateTeamDialog = () => {
    resetTeamDialogState();
    setIsCreateDialogOpen(true);
  };

  const openEditTeamDialog = (team: TeamListItem) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setMemberIds(team.members.map((member) => member.id));
    setMemberSearch("");
    setIsCreateDialogOpen(true);
  };

  const handleSaveTeam = () => {
    const trimmedName = teamName.trim();

    if (!trimmedName) {
      toast.error("Team name is required");
      return;
    }

    if (memberIds.length === 0) {
      toast.error("Select at least 1 employee");
      return;
    }

    const exists = teams.some(
      (team) =>
        team.name.toLowerCase() === trimmedName.toLowerCase() &&
        team.id !== editingTeamId
    );
    if (exists) {
      toast.error("Team name already exists");
      return;
    }

    startTransition(async () => {
      const result = editingTeamId
        ? await updateTeam({ teamId: editingTeamId, name: trimmedName, memberIds })
        : await createTeam({ name: trimmedName, memberIds });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const savedTeam = result.data;

      setTeams((current) => [savedTeam, ...current.filter((team) => team.id !== savedTeam.id)]);
      handleTeamDialogOpenChange(false);
      toast.success(editingTeamId ? "Team updated" : "Team created");
    });
  };

  const confirmDeleteTeam = () => {
    if (!deleteTeamTarget) return;

    startTransition(async () => {
      const result = await deleteTeam(deleteTeamTarget.teamId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setTeams((current) => current.filter((team) => team.id !== deleteTeamTarget.teamId));
      setDeleteTeamTarget(null);
      toast.success("Team deleted");
    });
  };

  const confirmRemoveEmployee = () => {
    if (!removeTarget) return;

    startTransition(async () => {
      const result = await removeEmployeeFromTeam(removeTarget.teamId, removeTarget.memberId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const updatedTeam = result.data;

      setTeams((current) =>
        current.map((team) => (team.id === updatedTeam.id ? updatedTeam : team))
      );
      setRemoveTarget(null);
      toast.success("Employee removed from team");
    });
  };

  return (
    <div className="space-y-0">
      <div className="relative">
        <div
          ref={toolbarShellRef}
          className="fixed inset-x-0 top-[4.75rem] z-30 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.995),rgba(255,255,255,0.99))] backdrop-blur-xl sm:top-20 md:top-[5.25rem]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-full h-3 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.995),rgba(255,255,255,0.99))] backdrop-blur-xl sm:h-4 md:h-5"
          />
          <div className="mx-auto w-full max-w-[1720px] px-3 sm:px-4 md:px-6">
            <Card className="gap-0 overflow-hidden rounded-[32px] border-slate-200/80 bg-white py-4 shadow-[0_28px_60px_-45px_rgba(15,23,42,0.3)] backdrop-blur-xl">
              <CardHeader className="grid-rows-[auto] gap-0 bg-[linear-gradient(135deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98),rgba(248,250,252,0.92))] pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      className="h-10 w-fit rounded-[12px] bg-sky-600 px-3.5 text-white shadow-[0_16px_24px_-20px_rgba(2,132,199,0.8)] hover:bg-sky-700"
                      onClick={openCreateTeamDialog}
                      disabled={isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Team
                    </Button>

                    <div className="relative w-full sm:w-[400px]">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-500" />
                      <Input
                        value={teamSearch}
                        onChange={(event) => setTeamSearch(event.target.value)}
                        placeholder="Search teams or members"
                        className="h-11 rounded-[16px] border border-sky-200 bg-white pl-11 pr-[160px] text-slate-900 shadow-[0_18px_30px_-24px_rgba(14,116,144,0.4)] ring-1 ring-sky-100/90 placeholder:text-slate-500 focus-visible:border-sky-400 focus-visible:ring-2 focus-visible:ring-sky-200"
                      />

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="absolute right-0 top-0 h-11 rounded-l-none rounded-r-[16px] border-0 border-l border-sky-100 bg-white px-4 text-sky-800 shadow-none hover:bg-sky-50"
                          >
                            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                            <span className="text-[12px] font-medium">{activeFilterOption.label}</span>
                            <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              {activeFilterOption.count}
                            </span>
                            <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-56 rounded-2xl border-sky-100 bg-white/95 p-2 shadow-[0_24px_42px_-32px_rgba(15,23,42,0.42)] backdrop-blur"
                        >
                          <DropdownMenuLabel className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Filter Teams
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-sky-100/80" />
                          <DropdownMenuRadioGroup
                            value={teamFilter}
                            onValueChange={(value) => setTeamFilter(value as TeamFilter)}
                          >
                            {filterOptions.map((option) => (
                              <DropdownMenuRadioItem
                                key={option.value}
                                value={option.value}
                                className="rounded-xl px-3 py-2 text-sm text-slate-700 focus:bg-sky-50 focus:text-sky-900"
                              >
                                <span>{option.label}</span>
                                <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                  {option.count}
                                </span>
                              </DropdownMenuRadioItem>
                            ))}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:w-auto lg:justify-end">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="min-w-[92px] rounded-[18px] border border-white/90 bg-white/85 px-3 py-2 text-center shadow-[0_16px_24px_-24px_rgba(15,23,42,0.4)] backdrop-blur">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Teams</p>
                        <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{teams.length}</p>
                      </div>
                      <div className="min-w-[92px] rounded-[18px] border border-white/90 bg-white/85 px-3 py-2 text-center shadow-[0_16px_24px_-24px_rgba(15,23,42,0.4)] backdrop-blur">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Members</p>
                        <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{totalTeamMembers}</p>
                      </div>
                      <div className="min-w-[92px] rounded-[18px] border border-white/90 bg-white/85 px-3 py-2 text-center shadow-[0_16px_24px_-24px_rgba(15,23,42,0.4)] backdrop-blur">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">Leads</p>
                        <p className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">{totalTeamLeaders}</p>
                      </div>
                    </div>

                    <div className="inline-flex h-11 overflow-hidden rounded-[12px] border border-sky-200 bg-white shadow-[0_14px_24px_-24px_rgba(14,116,144,0.45)]">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setTeamViewMode("grid")}
                        className={cn(
                          "h-11 w-11 rounded-none border-0 text-sky-700 hover:bg-sky-50",
                          teamViewMode === "grid" && "bg-sky-600 text-white hover:bg-sky-700"
                        )}
                        aria-label="Card view"
                        aria-pressed={teamViewMode === "grid"}
                        title="Card view"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setTeamViewMode("list")}
                        className={cn(
                          "h-11 w-11 rounded-none border-0 border-l border-sky-200 text-sky-700 hover:bg-sky-50",
                          teamViewMode === "list" && "border-sky-500 bg-sky-600 text-white hover:bg-sky-700"
                        )}
                        aria-label="List view"
                        aria-pressed={teamViewMode === "list"}
                        title="List view"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="min-h-[122px] sm:min-h-[126px] md:min-h-[132px]"
          style={toolbarShellHeight > 0 ? { height: `${toolbarShellHeight}px` } : undefined}
        />
      </div>

      <Card className="gap-0 overflow-hidden rounded-[32px] border-slate-200/80 bg-white/92 py-0 shadow-[0_28px_60px_-45px_rgba(15,23,42,0.26)] backdrop-blur-xl">
        <CardContent className="space-y-2.5 px-6 pb-6 pt-4">
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams created yet.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {teamsWithoutLead > 0 ? (
                  <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50/80 px-3 py-1 text-amber-700">
                    {teamsWithoutLead} team{teamsWithoutLead === 1 ? "" : "s"} need a leader
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50/80 px-3 py-1 text-emerald-700">
                    All teams have a leader assigned
                  </Badge>
                )}
                <Badge variant="outline" className="rounded-full border-slate-200 bg-white/85 px-3 py-1 text-slate-700">
                  Delete and member actions stay available here
                </Badge>
              </div>

              {filteredTeams.length === 0 ? (
                <p className="text-sm text-muted-foreground">No teams match your search.</p>
              ) : null}
            </>
          )}

          {filteredTeams.length > 0 ? (
            teamViewMode === "list" ? (
              <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_34px_-34px_rgba(15,23,42,0.18)]">
                <div className="divide-y divide-slate-200">
                  {filteredTeams.map((team) => (
                    <TeamOverviewCard
                      key={`${teamViewMode}-${team.id}`}
                      team={team}
                      viewMode={teamViewMode}
                      isPending={isPending}
                      onEditTeam={openEditTeamDialog}
                      onDeleteTeam={setDeleteTeamTarget}
                      onRemoveMember={setRemoveTarget}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid content-start items-start gap-2 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {filteredTeams.map((team) => (
                  <TeamOverviewCard
                    key={`${teamViewMode}-${team.id}`}
                    team={team}
                    viewMode={teamViewMode}
                    isPending={isPending}
                    onEditTeam={openEditTeamDialog}
                    onDeleteTeam={setDeleteTeamTarget}
                    onRemoveMember={setRemoveTarget}
                  />
                ))}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={handleTeamDialogOpenChange}>
        <DialogContent className="overflow-hidden border-slate-200 p-0 sm:max-w-5xl">
          <div className="max-h-[85vh] overflow-y-auto">
            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-sky-50/50 px-6 py-5">
              <DialogHeader className="text-left">
                <DialogTitle>{editingTeamId ? "Edit Team" : "Create Team"}</DialogTitle>
                <DialogDescription>
                  {editingTeamId
                    ? "Update the team name and assigned employees."
                    : "Add a new team and assign available employees only when you need to."}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="teamName">Team Name</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="e.g. Product Engineering"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label>Select Employees</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberSearch}
                    onChange={(event) => setMemberSearch(event.target.value)}
                    placeholder="Search by name or email"
                    className="pl-9 text-sm"
                    disabled={isPending}
                  />
                </div>
                <div className="rounded-xl border p-3">
                  {filteredMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {nonAdminEmployees.length === 0
                        ? "No employees available."
                        : selectableEmployees.length === 0
                          ? "All non-admin employees are already assigned to a team."
                          : "No employees match the search."}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {filteredMembers.map((employee) => {
                        const isChecked = memberIds.includes(employee.id);

                        return (
                          <Label
                            key={employee.id}
                            className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={(checked) => toggleMember(employee.id, checked === true)}
                                disabled={isPending}
                              />
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-base font-semibold">
                                {employee.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight">{employee.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{employee.email}</p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            >
                              {formatRoleLabel(employee.role)}
                            </Badge>
                          </Label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Selected In Team</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedMembers.length} selected
                  </span>
                </div>
                <div className="min-h-16 rounded-xl border p-2">
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.length === 0 ? (
                      <Badge variant="outline">No employees selected</Badge>
                    ) : (
                      selectedMembers.map((member) => (
                        <Badge key={member.id} variant="secondary">
                          {member.name} ({formatRoleLabel(member.role)})
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                Admin is excluded from selection. Employees already assigned to another team are hidden automatically.
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleTeamDialogOpenChange(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-sky-600 text-white hover:bg-sky-700"
                  onClick={handleSaveTeam}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UsersRound className="mr-2 h-4 w-4" />
                  )}
                  {editingTeamId ? "Save Changes" : "Create Team"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove employee from team?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                {removeTarget
                  ? `This action will remove ${removeTarget.memberName} from this team.`
                  : "This action will remove this employee from the team."}
              </span>
              <span className="mt-1 block">Please confirm to continue.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveEmployee}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              Confirm Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTeamTarget} onOpenChange={() => setDeleteTeamTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                {deleteTeamTarget
                  ? `This action will remove the team ${deleteTeamTarget.teamName}.`
                  : "This action will remove the selected team."}
              </span>
              <span className="mt-1 block">Please confirm to continue.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTeam}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
