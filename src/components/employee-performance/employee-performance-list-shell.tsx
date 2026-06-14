"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Clock3,
  SlidersHorizontal,
  FolderKanban,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeePerformanceListResponse } from "@/lib/employee-performance-types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const EMPLOYEES_PER_PAGE = 10;
const ALL_DEPARTMENTS = "all";
const UNASSIGNED_DEPARTMENT = "Unassigned";

function formatRoleLabel(role: string) {
  if (role === "TEAMLEADER") return "Team Leader";
  return role;
}

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function getDepartmentLabel(value: string | null) {
  return value?.trim() || UNASSIGNED_DEPARTMENT;
}

function getRoleBadgeClass(role: string) {
  if (role === "BA") return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200";
  if (role === "TEAMLEADER") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200";
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex justify-start">
        <Skeleton className="h-11 w-full rounded-2xl xl:max-w-xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={index}
            className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]"
          >
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-20" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function EmployeePerformanceListShell() {
  const [data, setData] = useState<EmployeePerformanceListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState(ALL_DEPARTMENTS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/employee-performance", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load employee performance data.");
        }

        const payload = (await response.json()) as EmployeePerformanceListResponse;
        if (!isActive) return;
        setData(payload);
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load employee performance data.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, selectedDepartment]);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set((data?.employees ?? []).map((employee) => getDepartmentLabel(employee.department)))
    ).sort((left, right) => left.localeCompare(right));
  }, [data?.employees]);

  const filteredEmployees = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return (data?.employees ?? []).filter((employee) => {
      const employeeDepartment = getDepartmentLabel(employee.department);
      const matchesDepartment =
        selectedDepartment === ALL_DEPARTMENTS || employeeDepartment === selectedDepartment;
      const matchesSearch =
        !query ||
        [
          employee.name,
          employee.email,
          employee.role,
          employeeDepartment,
          employee.position ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesDepartment && matchesSearch;
    });
  }, [data?.employees, deferredSearch, selectedDepartment]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / EMPLOYEES_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * EMPLOYEES_PER_PAGE;
  const visibleEmployees = filteredEmployees.slice(pageStart, pageStart + EMPLOYEES_PER_PAGE);
  const hasMultiplePages = filteredEmployees.length > EMPLOYEES_PER_PAGE;
  const hasActiveDepartmentFilter = selectedDepartment !== ALL_DEPARTMENTS;

  if (isLoading) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
        <CardHeader>
          <CardTitle>Employee Performance</CardTitle>
          <CardDescription>We could not load the performance module right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{error ?? "Unknown error"}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex justify-start">
        <div className="relative w-full xl:max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role, department, or email"
            className="h-11 rounded-2xl border-border/80 bg-background/95 pl-9 pr-12 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.5)]"
          />
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={hasActiveDepartmentFilter ? "default" : "ghost"}
                size="icon-sm"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl"
                aria-label="Open department filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 rounded-2xl p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Filter employees</p>
                  <p className="text-xs text-muted-foreground">Choose a department to narrow the list.</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Department
                  </p>
                  <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                    <Button
                      type="button"
                      variant={selectedDepartment === ALL_DEPARTMENTS ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start rounded-xl"
                      onClick={() => {
                        setSelectedDepartment(ALL_DEPARTMENTS);
                        setIsFilterOpen(false);
                      }}
                    >
                      All departments
                    </Button>
                    {departmentOptions.map((department) => (
                      <Button
                        key={department}
                        type="button"
                        variant={selectedDepartment === department ? "default" : "ghost"}
                        size="sm"
                        className="w-full justify-start rounded-xl"
                        onClick={() => {
                          setSelectedDepartment(department);
                          setIsFilterOpen(false);
                        }}
                      >
                        {department}
                      </Button>
                    ))}
                  </div>
                </div>

                {hasActiveDepartmentFilter ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => {
                      setSelectedDepartment(ALL_DEPARTMENTS);
                      setIsFilterOpen(false);
                    }}
                  >
                    Clear department filter
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.employeeCount}</div>
            <p className="text-xs text-muted-foreground">{data.summary.activeEmployees} currently active</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Monitored</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.averageProjectsPerEmployee.toFixed(1)} projects per employee
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Hours</CardTitle>
            <Clock3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(data.summary.monthlyHours)}</div>
            <p className="text-xs text-muted-foreground">Based on current-month work logs</p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-32px_rgba(15,23,42,0.55)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currencyFormatter.format(data.summary.monthlyRevenue)}</div>
            <p className="text-xs text-muted-foreground">Estimated from project value and logged contribution</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-card/95 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:shadow-[0_24px_60px_-36px_rgba(2,6,23,0.9)]">
        <CardContent className="space-y-4">
          <div className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Total Projects</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No employees matched your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEmployees.map((employee) => (
                    <TableRow key={employee.id} className="transition-colors hover:bg-muted/30">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">{employee.name}</div>
                          <div className="text-xs text-muted-foreground">{employee.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getRoleBadgeClass(employee.role)} variant="outline">
                          {formatRoleLabel(employee.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>{employee.department || "Unassigned"}</TableCell>
                      <TableCell className="text-right font-medium">{employee.totalProjects}</TableCell>
                      <TableCell className="text-right">{currencyFormatter.format(employee.monthlyRevenue)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/employee-performance/${employee.id}`}>
                            Open
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 lg:hidden">
            {filteredEmployees.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
                No employees matched your search.
              </div>
            ) : (
              visibleEmployees.map((employee) => (
                <Link
                  key={employee.id}
                  href={`/employee-performance/${employee.id}`}
                  className="group rounded-2xl border border-border/80 bg-background/80 p-4 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_24px_44px_-28px_rgba(15,23,42,0.5)] dark:shadow-[0_24px_60px_-34px_rgba(2,6,23,0.88)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">{employee.email}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge className={getRoleBadgeClass(employee.role)} variant="outline">
                      {formatRoleLabel(employee.role)}
                    </Badge>
                    <Badge variant={employee.isActive ? "default" : "secondary"}>
                      {employee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Department</p>
                      <p className="font-medium">{employee.department || "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Projects</p>
                      <p className="font-medium">{employee.totalProjects}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-medium">{currencyFormatter.format(employee.monthlyRevenue)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {hasMultiplePages ? (
            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {pageStart + 1}-{Math.min(pageStart + visibleEmployees.length, filteredEmployees.length)} of{" "}
                {filteredEmployees.length} employees
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="rounded-md border border-border/70 px-3 py-1 text-xs font-medium text-foreground">
                  Page {safeCurrentPage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
