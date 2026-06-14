"use client";

import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  FolderKanban,
  Loader2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EmployeeRevenueTrendChart,
  EmployeeTaskCompletionChart,
} from "@/components/employee-performance/employee-performance-charts";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  EmployeePerformanceDetailResponse,
  EmployeePerformanceRange,
} from "@/lib/employee-performance-types";

const RANGE_OPTIONS: Array<{ value: EmployeePerformanceRange; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatRoleLabel(role: string) {
  if (role === "TEAMLEADER") return "Team Leader";
  return role;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function getDateInputValue(value = new Date()) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRangeDateHint(range: EmployeePerformanceRange) {
  if (range === "daily") {
    return "Choose a date to load only that day's activity.";
  }

  if (range === "weekly") {
    return "Choose any date to load the full week that contains it.";
  }

  return "Choose any date to load the full month that contains it.";
}

function formatActivityDay(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatActivityTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActorInitial(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : "S";
}

function getRoleBadgeClass(role: string) {
  if (role === "BA") return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200";
  if (role === "TEAMLEADER") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
}

function DetailLoadingState() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card to-muted/80 p-4 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.45)] sm:p-5 dark:shadow-[0_28px_70px_-38px_rgba(2,6,23,0.9)]">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-7 w-60" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[360px] w-full rounded-3xl" />
        ))}
      </div>
    </div>
  );
}

export function EmployeePerformanceDetailShell({ employeeId }: { employeeId: string }) {
  const [range, setRange] = useState<EmployeePerformanceRange>("monthly");
  const [selectedDate, setSelectedDate] = useState(() => getDateInputValue(new Date()));
  const [data, setData] = useState<EmployeePerformanceDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        setError(null);
        if (hasLoadedRef.current) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const searchParams = new URLSearchParams({
          range,
          date: selectedDate,
        });
        const response = await fetch(`/api/employee-performance/${employeeId}?${searchParams.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(response.status === 404 ? "Employee performance record not found." : "Unable to load employee dashboard.");
        }

        const payload = (await response.json()) as EmployeePerformanceDetailResponse;
        if (!isActive) return;
        setData(payload);
        hasLoadedRef.current = true;
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load employee dashboard.");
      } finally {
        if (isActive) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, [employeeId, range, selectedDate]);

  if (isLoading) {
    return <DetailLoadingState />;
  }

  if (error || !data) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
        <CardHeader>
          <CardTitle>Employee Performance Dashboard</CardTitle>
          <CardDescription>The employee detail module could not be loaded.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/employee-performance">Back to List</Link>
            </Button>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const todayInputValue = getDateInputValue(new Date());
  const latestChange = data.changes.items[0] ?? null;
  const changesByDay = data.changes.items.reduce<Record<string, typeof data.changes.items>>((groups, item) => {
    const key = item.timestamp.slice(0, 10);
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
  const groupedChangeEntries = Object.entries(changesByDay).sort(([left], [right]) => right.localeCompare(left));
  const projectChangeCounts = data.changes.items.reduce<Record<string, number>>((acc, item) => {
    if (!item.projectName) return acc;
    acc[item.projectName] = (acc[item.projectName] ?? 0) + 1;
    return acc;
  }, {});
  const mostActiveProjectName =
    Object.entries(projectChangeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border/70 bg-gradient-to-r from-card via-card to-muted/80 p-4 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.45)] sm:p-5 dark:shadow-[0_28px_70px_-38px_rgba(2,6,23,0.9)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground hover:bg-transparent">
              <Link href="/employee-performance">
                <ArrowLeft className="h-4 w-4" />
                Back to employee list
              </Link>
            </Button>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={getRoleBadgeClass(data.employee.role)} variant="outline">
                  {formatRoleLabel(data.employee.role)}
                </Badge>
                <Badge variant={data.employee.status === "Active" ? "default" : "secondary"}>
                  {data.employee.status}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                  {data.rangeLabel}
                </Badge>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{data.employee.name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.employee.email}
                  {data.employee.department ? ` - ${data.employee.department}` : ""}
                  {data.employee.position ? ` - ${data.employee.position}` : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-background/85 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Joining Date</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{formatDate(data.employee.joinDate)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/85 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Department</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{data.employee.department || "Unassigned"}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/85 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Role</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{formatRoleLabel(data.employee.role)}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/85 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Phone</p>
                <p className="mt-1.5 text-sm font-medium text-foreground">{data.employee.phone || "-"}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 xl:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Flexible Work Monitoring
            </p>
            <div className="inline-flex rounded-2xl border border-border/80 bg-background/90 p-1 shadow-sm">
              {RANGE_OPTIONS.map((option) => {
                const active = option.value === range;

                return (
                  <Button
                    key={option.value}
                    type="button"
                    variant={active ? "default" : "ghost"}
                    size="sm"
                    disabled={isRefreshing && active}
                    className="rounded-xl px-4"
                    onClick={() => {
                      if (option.value === range) return;
                      startTransition(() => setRange(option.value));
                    }}
                  >
                    {option.label}
                    {isRefreshing && active ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  </Button>
                );
              })}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Reference Date</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[220px]">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={selectedDate}
                    className="pl-10"
                    onChange={(event) => {
                      const nextDate = event.target.value || todayInputValue;
                      if (nextDate === selectedDate) return;
                      startTransition(() => setSelectedDate(nextDate));
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  disabled={selectedDate === todayInputValue}
                  onClick={() => {
                    if (selectedDate === todayInputValue) return;
                    startTransition(() => setSelectedDate(todayInputValue));
                  }}
                >
                  Today
                </Button>
              </div>
            </div>
            <p className="max-w-sm text-xs text-muted-foreground">
              {getRangeDateHint(range)} Use the buttons above to switch how that selected date is grouped in the
              dashboard.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalProjects}</div>
            <p className="text-xs text-muted-foreground">{data.summary.ongoingProjects} currently ongoing</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Tracking</CardTitle>
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.pendingTasks} pending out of {data.summary.totalTasks} tracked tasks
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours Logged</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(data.summary.totalHours)}</div>
            <p className="text-xs text-muted-foreground">
              {formatHours(data.summary.billableHours)} billable - {data.summary.billableShare}% share
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(data.summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Estimated from project contribution in this range</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <EmployeeTaskCompletionChart data={data.charts.taskCompletion} />
        <EmployeeRevenueTrendChart data={data.charts.revenueTrend} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader>
            <CardTitle>Summary of Changes</CardTitle>
            <CardDescription>What changed for this employee inside {data.rangeLabel}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Changes Logged</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.totalChanges}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stage Moves</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.stageChanges}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Daily Updates</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.dailyUpdates}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Comments Added</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.commentsAdded}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tasks Created</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.tasksCreated}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Tasks Completed</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{data.changes.summary.tasksCompleted}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Highlights</p>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>
                  {data.changes.summary.totalChanges === 0
                    ? `No task or comment changes were recorded for ${data.rangeLabel}.`
                    : `${data.changes.summary.totalChanges} tracked changes were recorded for ${data.rangeLabel}.`}
                </p>
                {latestChange ? (
                  <p>
                    Latest change:
                    {" "}
                    <span className="font-medium text-foreground">{latestChange.title}</span>
                    {" "}
                    by
                    {" "}
                    <span className="font-medium text-foreground">{latestChange.actorName}</span>
                    {latestChange.taskName ? ` on ${latestChange.taskName}` : ""}.
                  </p>
                ) : null}
                {mostActiveProjectName ? (
                  <p>
                    Most active project in this period:
                    {" "}
                    <span className="font-medium text-foreground">{mostActiveProjectName}</span>.
                  </p>
                ) : null}
                <p>
                  Completed work in this range is reflected both in the task totals above and in the change history on
                  the right.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3 border-border/70 bg-card/95 py-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="gap-1 px-4">
            <CardTitle className="text-base">Recent Changes</CardTitle>
            <CardDescription className="text-xs">
              Task updates, stage moves, comments, and created work in the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {groupedChangeEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-xs text-muted-foreground">
                No recent task changes were recorded for this period.
              </div>
            ) : (
              <ScrollArea className="h-[560px] pr-2">
                <div className="space-y-4">
                  {groupedChangeEntries.map(([dayKey, items]) => (
                    <div key={dayKey} className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {formatActivityDay(items[0]?.timestamp ?? dayKey)}
                      </p>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex gap-3 rounded-2xl border border-border/70 bg-background/80 p-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                              {getActorInitial(item.actorName)}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-semibold text-foreground">{item.actorName}</span>
                                <span className="text-muted-foreground">{formatActivityTime(item.timestamp)}</span>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-foreground">{item.title}</p>
                                <p className="text-xs text-muted-foreground">{item.detail}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <Badge variant="outline" className="text-[11px]">
                                  {item.field}
                                </Badge>
                                {item.taskName ? (
                                  <Badge variant="secondary" className="text-[11px]">
                                    {item.taskName}
                                  </Badge>
                                ) : null}
                                {item.projectName ? (
                                  <Badge variant="outline" className="text-[11px]">
                                    {item.projectName}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Assigned projects with status, deadline, active task counts, time spent, and employee contribution value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No assigned project activity was found for this range.
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead className="text-right">Tasks</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{project.name}</div>
                            <div className="text-xs text-muted-foreground">{project.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              project.status === "Completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                            }
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(project.deadline)}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{project.completedTasks}</span>
                          <span className="text-muted-foreground"> / {project.totalTasks}</span>
                        </TableCell>
                        <TableCell className="text-right">{formatHours(project.timeSpentHours)}</TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(project.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader>
            <CardTitle>Task Tracking</CardTitle>
            <CardDescription>
              Tasks worked by this employee in the selected period, including assigned date, completion status, time
              taken, and inferred revenue contribution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No task activity matched the selected range.
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned Date</TableHead>
                      <TableHead>Time Taken</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{task.name}</div>
                            <div className="text-xs text-muted-foreground">{task.projectName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              task.status === "Completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                            }
                          >
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div>{formatDate(task.assignedDate)}</div>
                            <div className="text-xs text-muted-foreground">
                              Done: {task.completionDate ? formatDate(task.completionDate) : "-"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium">{formatHours(task.timeTakenHours)}</div>
                            <div className="text-xs text-muted-foreground">{task.updateCount} tracked updates</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{currencyFormatter.format(task.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader>
            <CardTitle>Calculation Notes</CardTitle>
            <CardDescription>How the dashboard interprets current project and task data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.notes.map((note) => (
              <div key={note} className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                {note}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
