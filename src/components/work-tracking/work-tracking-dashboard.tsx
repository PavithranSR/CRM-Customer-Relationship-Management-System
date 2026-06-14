"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowUpDown,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FolderKanban,
  LayoutList,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { createTimeEntry, deleteTimeEntry } from "@/actions/time-entry.actions";
import type {
  WorkTrackingEmployeeOption,
  WorkTrackingProjectOption,
  WorkTrackingTaskOption,
} from "@/actions/time-entry.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TimeEntryStatus = "DRAFT" | "SUBMITTED" | "APPROVED";
type BillableFilter = "all" | "billable" | "non-billable";
type DatePreset = "today" | "week" | "month" | "custom";
type GroupBy = "none" | "employee" | "project" | "task" | "date";
type SortField = "date" | "hours";
type SortDirection = "asc" | "desc";
type ViewMode = "list" | "weekly" | "project" | "employee";

interface WorkTrackingEntry {
  id: string;
  date: Date | string;
  hours: number;
  description: string | null;
  isBillable: boolean;
  status: TimeEntryStatus;
  taskId: string | null;
  taskTitle: string | null;
  user: { id: string; name: string };
  project: { id: string; name: string; code: string };
}

interface WorkTrackingDashboardProps {
  entries: WorkTrackingEntry[];
  projects: WorkTrackingProjectOption[];
  tasks: WorkTrackingTaskOption[];
  employees: WorkTrackingEmployeeOption[];
  currentUserId: string;
  currentUserName: string;
  showEmployeeColumn: boolean;
  canManageOthers: boolean;
}

const PAGE_SIZE = 12;

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function dateKey(value: Date | string) {
  return format(toDate(value), "yyyy-MM-dd");
}

function hoursLabel(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function getActionErrorMessage(error: unknown) {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    return Object.values(error)
      .flat()
      .filter(Boolean)
      .join(", ");
  }
  return "Something went wrong";
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function statusLabel(status: TimeEntryStatus) {
  if (status === "APPROVED") return "Approved";
  if (status === "SUBMITTED") return "Submitted";
  return "Draft";
}

function StatusBadge({ status }: { status: TimeEntryStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border px-2 py-1",
        status === "APPROVED" && "border-primary bg-primary text-primary-foreground",
        status === "SUBMITTED" && "border-primary/25 bg-primary/10 text-primary",
        status === "DRAFT" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {statusLabel(status)}
    </Badge>
  );
}

function BillableBadge({ isBillable }: { isBillable: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md border px-2 py-1",
        isBillable
          ? "border-primary bg-primary text-primary-foreground"
          : "border-danger/25 bg-danger/10 text-danger"
      )}
    >
      {isBillable ? "Yes" : "No"}
    </Badge>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Clock3;
  tone?: "blue" | "red";
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius)] border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase text-muted-foreground">{title}</p>
          <p className="mt-2 truncate text-xl font-semibold text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            tone === "blue" ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function EmptyState({
  hasAnyEntries,
  onLogTime,
  createTaskHref,
}: {
  hasAnyEntries: boolean;
  onLogTime: () => void;
  createTaskHref: string;
}) {
  return (
    <div className="flex min-h-[22rem] items-center justify-center px-4 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-primary">
          <Clock3 className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-lg font-semibold text-foreground">
          {hasAnyEntries ? "No matching entries" : "No time entries yet"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasAnyEntries
            ? "Adjust filters to find work logs across employees, projects, tasks, or dates."
            : "Start tracking work by logging time for a task or project"}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" className="bg-primary hover:bg-primary-hover" onClick={onLogTime}>
            <Plus className="h-4 w-4" />
            Log Time
          </Button>
          <Button asChild variant="outline">
            <Link href={createTaskHref}>Create Task</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function WorkTrackingDashboard({
  entries,
  projects,
  tasks,
  employees,
  currentUserId,
  currentUserName,
  showEmployeeColumn,
  canManageOthers,
}: WorkTrackingDashboardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [taskFilter, setTaskFilter] = useState("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [billableFilter, setBillableFilter] = useState<BillableFilter>("all");
  const [scope, setScope] = useState<"my" | "team">(showEmployeeColumn ? "team" : "my");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logProjectId, setLogProjectId] = useState("");
  const [logTaskId, setLogTaskId] = useState("");
  const [logEmployeeId, setLogEmployeeId] = useState(currentUserId);
  const [logBillable, setLogBillable] = useState(true);

  const today = useMemo(() => new Date(), []);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const selectedProject = projects.find((project) => project.id === logProjectId);
  const logTaskOptions = useMemo(
    () => tasks.filter((task) => task.projectId === logProjectId),
    [logProjectId, tasks]
  );
  const selectedTask = tasks.find((task) => task.id === logTaskId && task.projectId === logProjectId);
  const logEmployeeOptions = useMemo(() => {
    if (!canManageOthers) {
      return [{ id: currentUserId, name: currentUserName, role: "EMPLOYEE" }];
    }

    if (!selectedProject) {
      return employees;
    }

    const allowedIds = new Set(selectedProject.memberIds);
    if (selectedTask?.assigneeIds.length) {
      for (const assigneeId of selectedTask.assigneeIds) {
        allowedIds.add(assigneeId);
      }
    }

    const filtered = employees.filter((employee) => allowedIds.has(employee.id));
    return filtered.length > 0 ? filtered : employees;
  }, [canManageOthers, currentUserId, currentUserName, employees, selectedProject, selectedTask]);

  const effectiveLogTaskId = logTaskOptions.some((task) => task.id === logTaskId) ? logTaskId : "";
  const effectiveLogEmployeeId = logEmployeeOptions.some((employee) => employee.id === logEmployeeId)
    ? logEmployeeId
    : logEmployeeOptions[0]?.id ?? currentUserId;

  const taskFilterOptions = useMemo(
    () => (projectFilter === "all" ? [] : tasks.filter((task) => task.projectId === projectFilter)),
    [projectFilter, tasks]
  );

  const dateInterval = useMemo(() => {
    if (datePreset === "today") {
      return { start: startOfDay(today), end: endOfDay(today) };
    }

    if (datePreset === "month") {
      return { start: startOfMonth(today), end: endOfMonth(today) };
    }

    if (datePreset === "custom") {
      const start = customStart ? startOfDay(new Date(customStart)) : null;
      const end = customEnd ? endOfDay(new Date(customEnd)) : null;
      return start && end ? { start, end } : null;
    }

    return {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    };
  }, [customEnd, customStart, datePreset, today]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return entries.filter((entry) => {
      const entryDate = toDate(entry.date);
      const searchable = [
        entry.description,
        entry.taskTitle,
        entry.user.name,
        entry.project.name,
        entry.project.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (normalizedSearch && !searchable.includes(normalizedSearch)) return false;
      if (scope === "my" && entry.user.id !== currentUserId) return false;
      if (employeeFilter !== "all" && entry.user.id !== employeeFilter) return false;
      if (projectFilter !== "all" && entry.project.id !== projectFilter) return false;
      if (taskFilter !== "all" && entry.taskId !== taskFilter) return false;
      if (billableFilter === "billable" && !entry.isBillable) return false;
      if (billableFilter === "non-billable" && entry.isBillable) return false;
      if (dateInterval && !isWithinInterval(entryDate, dateInterval)) return false;

      return true;
    });
  }, [
    billableFilter,
    currentUserId,
    dateInterval,
    employeeFilter,
    entries,
    projectFilter,
    scope,
    search,
    taskFilter,
  ]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortField === "hours") {
        return (a.hours - b.hours) * multiplier;
      }
      return (toDate(a.date).getTime() - toDate(b.date).getTime()) * multiplier;
    });
  }, [filteredEntries, sortDirection, sortField]);

  const pageCount = Math.max(1, Math.ceil(sortedEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedEntries = sortedEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const summary = useMemo(() => {
    const todayInterval = { start: startOfDay(today), end: endOfDay(today) };
    const currentWeek = {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    };

    const todayEntries = entries.filter((entry) => isWithinInterval(toDate(entry.date), todayInterval));
    const weekEntries = entries.filter((entry) => isWithinInterval(toDate(entry.date), currentWeek));

    return {
      todayHours: todayEntries.reduce((sum, entry) => sum + entry.hours, 0),
      weekHours: weekEntries.reduce((sum, entry) => sum + entry.hours, 0),
      billableHours: weekEntries.filter((entry) => entry.isBillable).reduce((sum, entry) => sum + entry.hours, 0),
      nonBillableHours: weekEntries.filter((entry) => !entry.isBillable).reduce((sum, entry) => sum + entry.hours, 0),
      activeEmployees: new Set(weekEntries.map((entry) => entry.user.id)).size,
      activeProjects: new Set(weekEntries.map((entry) => entry.project.id)).size,
    };
  }, [entries, today]);

  const weeklyRows = useMemo(() => {
    const currentWeek = {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    };
    const rows = new Map<string, { label: string; project: string; days: number[]; total: number }>();

    for (const entry of sortedEntries) {
      const entryDate = toDate(entry.date);
      if (!isWithinInterval(entryDate, currentWeek)) {
        continue;
      }

      const key = entry.taskId ?? `${entry.project.id}:unlinked`;
      const existing =
        rows.get(key) ??
        {
          label: entry.taskTitle ?? "Unlinked task",
          project: `${entry.project.name} (${entry.project.code})`,
          days: Array(7).fill(0) as number[],
          total: 0,
        };
      const dayIndex = weekDays.findIndex((day) => dateKey(day) === dateKey(entryDate));
      if (dayIndex >= 0) {
        existing.days[dayIndex] += entry.hours;
        existing.total += entry.hours;
      }
      rows.set(key, existing);
    }

    return Array.from(rows.values()).sort((a, b) => b.total - a.total);
  }, [sortedEntries, today, weekDays]);

  const createTaskHref = projectFilter !== "all" ? `/projects/${projectFilter}?view=kanban` : "/projects?view=allTasks";

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection(field === "date" ? "desc" : "asc");
  }

  function handleDelete() {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteTimeEntry(deleteId);
      if (result.error) {
        toast.error(getActionErrorMessage(result.error));
      } else {
        toast.success("Time entry deleted");
        router.refresh();
      }
      setDeleteId(null);
    });
  }

  function handleCreate(formData: FormData) {
    formData.set("isBillable", String(logBillable));
    formData.set("status", "DRAFT");
    formData.set("employeeId", canManageOthers ? effectiveLogEmployeeId : currentUserId);
    formData.set("taskId", effectiveLogTaskId);

    startTransition(async () => {
      const result = await createTimeEntry(formData);
      if (result.error) {
        toast.error(getActionErrorMessage(result.error));
        return;
      }

      toast.success("Time entry logged");
      setIsLogDialogOpen(false);
      setLogProjectId("");
      setLogTaskId("");
      setLogEmployeeId(currentUserId);
      setLogBillable(true);
      router.refresh();
    });
  }

  function exportCsv() {
    const headers = ["Date", "Employee", "Project", "Task", "Description", "Hours", "Billable", "Status"];
    const rows = sortedEntries.map((entry) => [
      dateKey(entry.date),
      entry.user.name,
      `${entry.project.name} (${entry.project.code})`,
      entry.taskTitle ?? "Unlinked task",
      entry.description ?? "",
      entry.hours,
      entry.isBillable ? "Yes" : "No",
      statusLabel(entry.status),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `work-tracking-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderEntryActions(entry: WorkTrackingEntry) {
    const canEditEntry = canManageOthers || entry.user.id === currentUserId;
    if (!canEditEntry) return null;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/work-tracking/${entry.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="text-danger" onClick={() => setDeleteId(entry.id)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function getGroupLabel(entry: WorkTrackingEntry) {
    if (groupBy === "employee") return entry.user.name;
    if (groupBy === "project") return `${entry.project.name} (${entry.project.code})`;
    if (groupBy === "task") return entry.taskTitle ?? "Unlinked task";
    if (groupBy === "date") return format(toDate(entry.date), "MMM d, yyyy");
    return "";
  }

  function renderTableRows() {
    if (paginatedEntries.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <EmptyState
              hasAnyEntries={entries.length > 0}
              onLogTime={() => setIsLogDialogOpen(true)}
              createTaskHref={createTaskHref}
            />
          </TableCell>
        </TableRow>
      );
    }

    let lastGroup = "";
    return paginatedEntries.flatMap((entry) => {
      const groupLabel = getGroupLabel(entry);
      const groupRow =
        groupBy !== "none" && groupLabel !== lastGroup ? (
          <TableRow key={`${entry.id}-group`} className="bg-primary/5 hover:bg-primary/5">
            <TableCell colSpan={9} className="px-3 py-2 text-xs font-semibold uppercase text-primary">
              {groupLabel}
            </TableCell>
          </TableRow>
        ) : null;
      lastGroup = groupLabel || lastGroup;

      const entryRow = (
        <TableRow key={entry.id} className="bg-card">
          <TableCell className="min-w-28">
            <p className="font-medium text-foreground">{format(toDate(entry.date), "MMM d, yyyy")}</p>
            <p className="text-xs text-muted-foreground">{format(toDate(entry.date), "EEE")}</p>
          </TableCell>
          <TableCell className={cn(!showEmployeeColumn && "hidden")}>{entry.user.name}</TableCell>
          <TableCell>
            <Link href={`/projects/${entry.project.id}`} className="font-medium text-foreground hover:text-primary">
              {entry.project.name}
            </Link>
            <p className="text-xs text-muted-foreground">{entry.project.code}</p>
          </TableCell>
          <TableCell className="min-w-48">
            <p className="font-medium text-foreground">{entry.taskTitle ?? "Unlinked task"}</p>
          </TableCell>
          <TableCell className="max-w-sm whitespace-normal text-muted-foreground">
            {entry.description || "-"}
          </TableCell>
          <TableCell className="font-semibold text-foreground">{hoursLabel(entry.hours)}</TableCell>
          <TableCell>
            <BillableBadge isBillable={entry.isBillable} />
          </TableCell>
          <TableCell>
            <StatusBadge status={entry.status} />
          </TableCell>
          <TableCell className="text-right">{renderEntryActions(entry)}</TableCell>
        </TableRow>
      );

      return groupRow ? [groupRow, entryRow] : [entryRow];
    });
  }

  function renderGroupedView(kind: "project" | "employee") {
    const grouped = new Map<string, { label: string; subtitle: string; total: number; entries: WorkTrackingEntry[] }>();

    for (const entry of sortedEntries) {
      const key = kind === "project" ? entry.project.id : entry.user.id;
      const existing =
        grouped.get(key) ??
        {
          label: kind === "project" ? entry.project.name : entry.user.name,
          subtitle: kind === "project" ? entry.project.code : `${new Set(sortedEntries.filter((item) => item.user.id === entry.user.id).map((item) => item.project.id)).size} projects`,
          total: 0,
          entries: [],
        };
      existing.total += entry.hours;
      existing.entries.push(entry);
      grouped.set(key, existing);
    }

    const groups = Array.from(grouped.values()).sort((a, b) => b.total - a.total);

    if (groups.length === 0) {
      return (
        <EmptyState
          hasAnyEntries={entries.length > 0}
          onLogTime={() => setIsLogDialogOpen(true)}
          createTaskHref={createTaskHref}
        />
      );
    }

    return (
      <div className="grid gap-3 p-3">
        {groups.map((group) => (
          <div key={group.label} className="rounded-[var(--radius)] border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="font-semibold text-foreground">{group.label}</p>
                <p className="text-xs text-muted-foreground">{group.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-semibold text-primary">{hoursLabel(group.total)}</p>
                <p className="text-xs text-muted-foreground">{group.entries.length} entries</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {group.entries.slice(0, 5).map((entry) => (
                <div key={entry.id} className="grid gap-2 py-3 text-sm md:grid-cols-[9rem_1fr_7rem_6rem]">
                  <span className="text-muted-foreground">{format(toDate(entry.date), "MMM d, yyyy")}</span>
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {kind === "project" ? entry.user.name : `${entry.project.name} - ${entry.taskTitle ?? "Unlinked task"}`}
                  </span>
                  <span className="text-muted-foreground">{entry.isBillable ? "Billable" : "Non-billable"}</span>
                  <span className="font-semibold text-foreground md:text-right">{hoursLabel(entry.hours)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-[var(--shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h1 className="dashboard-title">Work Tracking</h1>
          <p className="text-sm text-muted-foreground">Track employee time entries by project and task</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="bg-primary hover:bg-primary-hover" onClick={() => setIsLogDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Log Time
          </Button>
          <Button type="button" variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button type="button" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Hours"
          value={hoursLabel(summary.weekHours)}
          detail={`${hoursLabel(summary.todayHours)} today`}
          icon={Clock3}
        />
        <MetricCard
          title="Billable Hours"
          value={hoursLabel(summary.billableHours)}
          detail="This week"
          icon={CircleDollarSign}
        />
        <MetricCard
          title="Non-Billable"
          value={hoursLabel(summary.nonBillableHours)}
          detail="This week"
          icon={CalendarDays}
          tone="red"
        />
        <MetricCard
          title="Active Employees"
          value={String(summary.activeEmployees)}
          detail="Logged this week"
          icon={Users}
        />
        <MetricCard
          title="Active Projects"
          value={String(summary.activeProjects)}
          detail="With tracked work"
          icon={BriefcaseBusiness}
        />
      </div>

      <div className="rounded-[var(--radius)] border border-border bg-card p-3 shadow-[var(--shadow-sm)]">
        <div
          className={cn(
            "grid gap-2",
            showEmployeeColumn
              ? "xl:grid-cols-[minmax(16rem,1.4fr)_repeat(6,minmax(9rem,1fr))]"
              : "xl:grid-cols-[minmax(16rem,1.4fr)_repeat(5,minmax(9rem,1fr))]"
          )}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder={
                showEmployeeColumn
                  ? "Search description, task, or employee"
                  : "Search description or task"
              }
            />
          </div>
          {showEmployeeColumn ? (
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Select
            value={projectFilter}
            onValueChange={(value) => {
              setProjectFilter(value);
              setTaskFilter("all");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={taskFilter} onValueChange={setTaskFilter} disabled={projectFilter === "all"}>
            <SelectTrigger>
              <SelectValue placeholder="Task" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              {taskFilterOptions.map((task) => (
                <SelectItem key={task.id} value={task.id}>
                  {task.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={datePreset} onValueChange={(value) => setDatePreset(value as DatePreset)}>
            <SelectTrigger>
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={billableFilter} onValueChange={(value) => setBillableFilter(value as BillableFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Billable" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All billing</SelectItem>
              <SelectItem value="billable">Billable</SelectItem>
              <SelectItem value="non-billable">Non-billable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
            <SelectTrigger>
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Group: None</SelectItem>
              {showEmployeeColumn ? (
                <SelectItem value="employee">Group: Employee</SelectItem>
              ) : null}
              <SelectItem value="project">Group: Project</SelectItem>
              <SelectItem value="task">Group: Task</SelectItem>
              <SelectItem value="date">Group: Date</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {datePreset === "custom" ? (
            <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
              <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
              <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
            </div>
          ) : (
            <div className="text-xs font-medium text-muted-foreground">
              {dateInterval
                ? `${format(dateInterval.start, "MMM d")} - ${format(dateInterval.end, "MMM d, yyyy")}`
                : "Select a custom range"}
            </div>
          )}
          <div className="flex rounded-[var(--radius)] border border-border bg-card p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={cn("h-7 px-3", scope === "my" && "bg-card text-primary shadow-[var(--shadow-sm)]")}
              onClick={() => setScope("my")}
            >
              My Entries
            </Button>
            {showEmployeeColumn ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn("h-7 px-3", scope === "team" && "bg-card text-primary shadow-[var(--shadow-sm)]")}
                onClick={() => setScope("team")}
              >
                Team Entries
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)} className="min-h-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="h-10 bg-card shadow-[var(--shadow-sm)]">
            <TabsTrigger value="list">
              <LayoutList className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="weekly">
              <CalendarRange className="h-4 w-4" />
              Weekly Timesheet
            </TabsTrigger>
            <TabsTrigger value="project">
              <FolderKanban className="h-4 w-4" />
              Project View
            </TabsTrigger>
            {showEmployeeColumn ? (
              <TabsTrigger value="employee">
                <UserRound className="h-4 w-4" />
                Employee View
              </TabsTrigger>
            ) : null}
          </TabsList>
          <div className="text-sm text-muted-foreground">
            {sortedEntries.length} entries - {hoursLabel(sortedEntries.reduce((sum, entry) => sum + entry.hours, 0))}
          </div>
        </div>

        <TabsContent value="list" className="min-h-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-sm)]">
          <div className="flex h-full min-h-[26rem] flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>
                      <Button type="button" variant="ghost" size="sm" className="h-auto px-0" onClick={() => toggleSort("date")}>
                        Date
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className={cn(!showEmployeeColumn && "hidden")}>Employee</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>
                      <Button type="button" variant="ghost" size="sm" className="h-auto px-0" onClick={() => toggleSort("hours")}>
                        Hours
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{renderTableRows()}</TableBody>
              </Table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Page {currentPage} of {pageCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weekly" className="min-h-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-sm)]">
          <div className="h-full min-h-[26rem] overflow-auto">
            {weeklyRows.length === 0 ? (
              <EmptyState
                hasAnyEntries={entries.length > 0}
                onLogTime={() => setIsLogDialogOpen(true)}
                createTaskHref={createTaskHref}
              />
            ) : (
              <table className="w-full min-w-[860px] text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b border-border">
                    <th className="w-72 px-3 py-3 text-left font-semibold text-foreground">Task / Project</th>
                    {weekDays.map((day) => (
                      <th key={dateKey(day)} className="px-3 py-3 text-center font-semibold text-foreground">
                        <span className="block">{format(day, "EEE")}</span>
                        <span className="text-xs font-normal text-muted-foreground">{format(day, "MMM d")}</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-semibold text-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyRows.map((row) => (
                    <tr key={`${row.project}-${row.label}`} className="border-b border-border">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-foreground">{row.label}</p>
                        <p className="text-xs text-muted-foreground">{row.project}</p>
                      </td>
                      {row.days.map((hours, index) => (
                        <td key={index} className="px-3 py-3 text-center">
                          <span className={cn("inline-flex min-w-12 justify-center rounded-[calc(var(--radius)-4px)] px-2 py-1 font-medium", hours > 0 ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                            {hours > 0 ? hoursLabel(hours) : "-"}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-3 text-right text-base font-semibold text-foreground">{hoursLabel(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-card">
                  <tr className="border-t border-border">
                    <td className="px-3 py-3 font-semibold text-foreground">Weekly total</td>
                    {weekDays.map((day) => {
                      const total = sortedEntries
                        .filter((entry) => dateKey(entry.date) === dateKey(day))
                        .reduce((sum, entry) => sum + entry.hours, 0);
                      return (
                        <td key={dateKey(day)} className="px-3 py-3 text-center font-semibold text-foreground">
                          {total > 0 ? hoursLabel(total) : "-"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-right text-lg font-bold text-primary">
                      {hoursLabel(weeklyRows.reduce((sum, row) => sum + row.total, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="project" className="min-h-0 overflow-auto rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-sm)]">
          {renderGroupedView("project")}
        </TabsContent>

        <TabsContent value="employee" className="min-h-0 overflow-auto rounded-[var(--radius)] border border-border bg-card shadow-[var(--shadow-sm)]">
          {renderGroupedView("employee")}
        </TabsContent>
      </Tabs>

      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Log Time</DialogTitle>
            <DialogDescription>Record work against a task and project.</DialogDescription>
          </DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee</Label>
                {canManageOthers ? (
                  <Select name="employeeId" value={effectiveLogEmployeeId} onValueChange={setLogEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {logEmployeeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input value={currentUserName} disabled />
                    <input type="hidden" name="employeeId" value={currentUserId} />
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select
                  name="projectId"
                  value={logProjectId}
                  onValueChange={(value) => {
                    setLogProjectId(value);
                    setLogTaskId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Task</Label>
                <Select name="taskId" value={effectiveLogTaskId} onValueChange={setLogTaskId} disabled={!logProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={logProjectId ? "Select task" : "Select project first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {logTaskOptions.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-entry-date">Date</Label>
                <Input
                  id="time-entry-date"
                  name="date"
                  type="date"
                  defaultValue={format(new Date(), "yyyy-MM-dd")}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time-entry-hours">Hours</Label>
                <Input
                  id="time-entry-hours"
                  name="hours"
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  placeholder="2.5"
                  required
                />
              </div>
              <div className="flex items-end">
                <div className="flex h-9 items-center gap-2 rounded-[var(--radius)] border border-border px-3">
                  <Checkbox
                    id="time-entry-billable"
                    checked={logBillable}
                    onCheckedChange={(checked) => setLogBillable(checked === true)}
                  />
                  <Label htmlFor="time-entry-billable" className="cursor-pointer text-sm">
                    Billable
                  </Label>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="time-entry-description">Description</Label>
                <Textarea
                  id="time-entry-description"
                  name="description"
                  placeholder="Work completed, blocker resolved, or client deliverable"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLogDialogOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-hover"
                disabled={isPending || !logProjectId || !effectiveLogTaskId}
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected time entry and update project actual hours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-danger hover:bg-danger/90">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
