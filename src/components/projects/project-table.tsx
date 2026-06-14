"use client";

import { useMemo, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { deleteProject, updateProjectStatus } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Play, Pause, CheckCircle, Settings, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Priority, ProjectStatus, ProjectType } from "@prisma/client";
import { HoldDialog } from "./hold-dialog";

interface Project {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  clientId?: string | null;
  serviceName?: string | null;
  unitName?: string | null;
  unitCount?: number | null;
  unitPrice?: number | null;
  costPerUnit?: number | null;
  subtotalAmount?: number | null;
  gstPercent?: number | null;
  gstAmount?: number | null;
  finalAmount?: number | null;
  profitAmount?: number | null;
  invoicingPolicy?: string | null;
  tags?: string | null;
  expectedClosingDate?: Date | null;
  type: ProjectType;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  estimatedHours?: number | null;
  startDate?: Date | null;
  deadline: Date | null;
  managerId?: string | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string } }[];
  _count: { timeEntries: number };
  taskCount: number;
}

interface ProjectTableProps {
  projects: Project[];
  canManage: boolean;
  canEditProjects?: boolean;
  canDelete?: boolean;
  showTlDetailsMenu?: boolean;
  onEditProject?: (project: Project) => void;
}

type ProjectColumnKey =
  | "name"
  | "code"
  | "type"
  | "status"
  | "priority"
  | "progress"
  | "deadline"
  | "team"
  | "description"
  | "client"
  | "manager"
  | "startDate"
  | "expectedClosingDate"
  | "estimatedHours"
  | "taskCount"
  | "timeEntries"
  | "unitName"
  | "unitCount"
  | "unitPrice"
  | "costPerUnit"
  | "subtotalAmount"
  | "gstPercent"
  | "gstAmount"
  | "finalAmount"
  | "profitAmount"
  | "invoicingPolicy"
  | "tags";

interface ProjectColumnOption {
  key: ProjectColumnKey;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (project: Project) => ReactNode;
}

const statusColors: Record<ProjectStatus, string> = {
  PLANNING: "bg-gray-500",
  IN_PROGRESS: "bg-blue-500",
  ON_HOLD: "bg-yellow-500",
  COMPLETED: "bg-green-500",
  CANCELLED: "bg-red-500",
};

const priorityColors: Record<Priority, string> = {
  LOW: "bg-gray-400",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const PROJECT_TABLE_VISIBLE_COLUMNS_LEGACY_STORAGE_KEY = "project-table-visible-columns";
const PROJECT_TABLE_VISIBLE_COLUMNS_STORAGE_KEY = "project-table-visible-columns-v2";
const PROJECT_TABLE_VISIBLE_COLUMNS_EVENT = "project-table-visible-columns-change";

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

const PROJECT_COLUMN_OPTIONS: ProjectColumnOption[] = [
  {
    key: "name",
    label: "Project",
    cellClassName: "font-medium text-slate-900",
    render: (project) => (
      <div>
        <Link href={`/projects/${project.id}?view=kanban`} className="hover:underline">
          {project.name}
        </Link>
        <p className="text-sm text-muted-foreground">{project.code}</p>
      </div>
    ),
  },
  {
    key: "code",
    label: "Code",
    render: (project) => project.code || "-",
  },
  {
    key: "type",
    label: "Type",
    render: (project) => <Badge variant="outline">{project.type}</Badge>,
  },
  {
    key: "status",
    label: "Status",
    render: (project) => <Badge className={statusColors[project.status]}>{project.status.replace("_", " ")}</Badge>,
  },
  {
    key: "priority",
    label: "Priority",
    render: (project) => <Badge className={priorityColors[project.priority]}>{project.priority}</Badge>,
  },
  {
    key: "progress",
    label: "Progress",
    render: (project) => (
      <div className="flex items-center gap-2">
        <Progress value={project.progress} className="h-2 w-20" />
        <span className="text-sm">{project.progress}%</span>
      </div>
    ),
  },
  {
    key: "deadline",
    label: "Deadline",
    render: (project) => (project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "-"),
  },
  {
    key: "description",
    label: "Description",
    cellClassName: "max-w-[280px] text-slate-700",
    render: (project) => project.description?.trim() || "-",
  },
  {
    key: "client",
    label: "Client",
    render: (project) => project.clientId || "-",
  },
  {
    key: "manager",
    label: "Manager",
    render: (project) => project.manager?.name || "-",
  },
  {
    key: "startDate",
    label: "Start Date",
    render: (project) => (project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "-"),
  },
  {
    key: "expectedClosingDate",
    label: "Expected Closing",
    render: (project) =>
      project.expectedClosingDate ? format(new Date(project.expectedClosingDate), "MMM d, yyyy") : "-",
  },
  {
    key: "estimatedHours",
    label: "Estimated Hours",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) => (project.estimatedHours === null || project.estimatedHours === undefined ? "-" : project.estimatedHours),
  },
  {
    key: "taskCount",
    label: "Tasks",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) => project.taskCount,
  },
  {
    key: "timeEntries",
    label: "Time Entries",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) => project._count.timeEntries,
  },
  {
    key: "unitName",
    label: "Unit Name",
    render: (project) => project.unitName || "-",
  },
  {
    key: "unitCount",
    label: "Unit Count",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) => (project.unitCount === null || project.unitCount === undefined ? "-" : project.unitCount),
  },
  {
    key: "unitPrice",
    label: "Unit Price",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.unitPrice === null || project.unitPrice === undefined ? "-" : formatCurrency(project.unitPrice),
  },
  {
    key: "costPerUnit",
    label: "Cost / Unit",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.costPerUnit === null || project.costPerUnit === undefined ? "-" : formatCurrency(project.costPerUnit),
  },
  {
    key: "subtotalAmount",
    label: "Subtotal",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.subtotalAmount === null || project.subtotalAmount === undefined
        ? "-"
        : formatCurrency(project.subtotalAmount),
  },
  {
    key: "gstPercent",
    label: "GST %",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.gstPercent === null || project.gstPercent === undefined ? "-" : `${Number(project.gstPercent).toFixed(2)}%`,
  },
  {
    key: "gstAmount",
    label: "GST Amount",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.gstAmount === null || project.gstAmount === undefined ? "-" : formatCurrency(project.gstAmount),
  },
  {
    key: "finalAmount",
    label: "Final Amount",
    headerClassName: "text-right",
    cellClassName: "text-right font-semibold text-slate-900",
    render: (project) =>
      project.finalAmount === null || project.finalAmount === undefined ? "-" : formatCurrency(project.finalAmount),
  },
  {
    key: "profitAmount",
    label: "Profit",
    headerClassName: "text-right",
    cellClassName: "text-right",
    render: (project) =>
      project.profitAmount === null || project.profitAmount === undefined ? "-" : formatCurrency(project.profitAmount),
  },
  {
    key: "invoicingPolicy",
    label: "Invoicing Policy",
    render: (project) => project.invoicingPolicy?.trim() || "-",
  },
  {
    key: "tags",
    label: "Tags",
    render: (project) => project.tags?.trim() || "-",
  },
  {
    key: "team",
    label: "Team",
    render: (project) => (
      <div className="flex -space-x-2">
        {project.assignments.slice(0, 3).map((a) => (
          <div
            key={a.user.id}
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-medium"
            title={a.user.name}
          >
            {a.user.name.charAt(0)}
          </div>
        ))}
        {project.assignments.length > 3 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium">
            +{project.assignments.length - 3}
          </div>
        )}
      </div>
    ),
  },
];

const DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS: ProjectColumnKey[] = [
  "name",
  "type",
  "status",
  "priority",
  "progress",
  "deadline",
  "manager",
  "team",
];
const DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS_SNAPSHOT = JSON.stringify(
  DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS
);

function getAllProjectColumnKeys() {
  return PROJECT_COLUMN_OPTIONS.map((column) => column.key);
}

function normalizeProjectTableVisibleColumnKeys(value: unknown) {
  const allowedKeys = new Set(getAllProjectColumnKeys());
  if (!Array.isArray(value)) {
    return [] as ProjectColumnKey[];
  }

  return Array.from(
    new Set(
      value.filter(
        (key): key is ProjectColumnKey =>
          typeof key === "string" && allowedKeys.has(key as ProjectColumnKey)
      )
    )
  );
}

function readStoredProjectTableVisibleColumnsFromKey(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = window.localStorage.getItem(storageKey);
  if (!storedValue) {
    return null;
  }

  try {
    return normalizeProjectTableVisibleColumnKeys(JSON.parse(storedValue));
  } catch {
    window.localStorage.removeItem(storageKey);
    return null;
  }
}

function resolveProjectTableVisibleColumnKeys(snapshot: string | null | undefined) {
  if (!snapshot) {
    return DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS;
  }

  const normalizedKeys = normalizeProjectTableVisibleColumnKeys(JSON.parse(snapshot));
  return normalizedKeys.length > 0
    ? normalizedKeys
    : DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS;
}

function getProjectTableVisibleColumnsSnapshot() {
  if (typeof window === "undefined") {
    return DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS_SNAPSHOT;
  }

  const storedKeys = readStoredProjectTableVisibleColumnsFromKey(
    PROJECT_TABLE_VISIBLE_COLUMNS_STORAGE_KEY
  );
  if (storedKeys && storedKeys.length > 0) {
    return JSON.stringify(storedKeys);
  }

  const legacyKeys = readStoredProjectTableVisibleColumnsFromKey(
    PROJECT_TABLE_VISIBLE_COLUMNS_LEGACY_STORAGE_KEY
  );
  if (!legacyKeys || legacyKeys.length === 0) {
    return DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS_SNAPSHOT;
  }

  const allProjectColumnKeys = getAllProjectColumnKeys();
  const migratedKeys =
    legacyKeys.length === allProjectColumnKeys.length &&
    allProjectColumnKeys.every((key) => legacyKeys.includes(key))
      ? DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS
      : legacyKeys;

  return JSON.stringify(migratedKeys);
}

function writeStoredProjectTableVisibleColumnKeys(keys: ProjectColumnKey[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedKeys = normalizeProjectTableVisibleColumnKeys(keys);
  const nextKeys =
    normalizedKeys.length > 0 ? normalizedKeys : DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS;

  window.localStorage.setItem(
    PROJECT_TABLE_VISIBLE_COLUMNS_STORAGE_KEY,
    JSON.stringify(nextKeys)
  );
  window.localStorage.removeItem(PROJECT_TABLE_VISIBLE_COLUMNS_LEGACY_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PROJECT_TABLE_VISIBLE_COLUMNS_EVENT));
}

function subscribeToProjectTableVisibleColumns(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleChange = () => callback();
  window.addEventListener("storage", handleChange);
  window.addEventListener(PROJECT_TABLE_VISIBLE_COLUMNS_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(PROJECT_TABLE_VISIBLE_COLUMNS_EVENT, handleChange);
  };
}

export function ProjectTable({
  projects,
  canManage,
  canEditProjects = false,
  canDelete = false,
  showTlDetailsMenu = false,
  onEditProject,
}: ProjectTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [holdProjectId, setHoldProjectId] = useState<string | null>(null);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);
  const visibleColumnKeysSnapshot = useSyncExternalStore(
    subscribeToProjectTableVisibleColumns,
    getProjectTableVisibleColumnsSnapshot,
    () => DEFAULT_PROJECT_TABLE_VISIBLE_COLUMN_KEYS_SNAPSHOT
  );
  const visibleColumnKeys = useMemo(
    () => resolveProjectTableVisibleColumnKeys(visibleColumnKeysSnapshot),
    [visibleColumnKeysSnapshot]
  );
  const getProjectTasksHref = (projectId: string) => `/projects/${projectId}?view=kanban`;

  const visibleColumns = useMemo(
    () => PROJECT_COLUMN_OPTIONS.filter((column) => visibleColumnKeys.includes(column.key)),
    [visibleColumnKeys]
  );
  const visibleCardColumns = useMemo(
    () => visibleColumns.filter((column) => column.key !== "name"),
    [visibleColumns]
  );
  const showColumnPicker = PROJECT_COLUMN_OPTIONS.length > 1;
  const showActionsColumn = canManage || showTlDetailsMenu;
  const canEditProject = canEditProjects || Boolean(onEditProject);

  const toggleColumn = (columnKey: ProjectColumnKey, checked: boolean) => {
    let nextKeys: ProjectColumnKey[];

    if (checked) {
      nextKeys = getAllProjectColumnKeys().filter(
        (key) => key === columnKey || visibleColumnKeys.includes(key)
      );
    } else if (visibleColumnKeys.length === 1 && visibleColumnKeys.includes(columnKey)) {
      nextKeys = visibleColumnKeys;
    } else {
      nextKeys = visibleColumnKeys.filter((key) => key !== columnKey);
    }

    writeStoredProjectTableVisibleColumnKeys(nextKeys);
  };

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteProject(deleteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project deleted successfully");
      }
      setDeleteId(null);
    });
  };

  const handleStatusChange = (id: string, status: ProjectStatus) => {
    startTransition(async () => {
      const result = await updateProjectStatus(id, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project status updated");
      }
    });
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {projects.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No projects found
            </div>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={getProjectTasksHref(project.id)}
                      className="block truncate text-base font-semibold hover:underline"
                    >
                      {project.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">{project.code}</p>
                  </div>
                  {showActionsColumn ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={isPending} aria-label={`Open actions for ${project.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}?view=details`}>
                              <Settings className="mr-2 h-4 w-4" />
                              Settings
                            </Link>
                          </DropdownMenuItem>
                          {canEditProject ? (
                            <DropdownMenuItem onClick={() => onEditProject?.(project)}>
                              Edit
                            </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        {project.status !== "IN_PROGRESS" && project.status !== "COMPLETED" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(project.id, "IN_PROGRESS")}>
                            <Play className="mr-2 h-4 w-4" />
                            Start Project
                          </DropdownMenuItem>
                        )}
                        {project.status === "IN_PROGRESS" && (
                          <DropdownMenuItem onClick={() => setHoldProjectId(project.id)}>
                            <Pause className="mr-2 h-4 w-4" />
                            Put on Hold
                          </DropdownMenuItem>
                        )}
                        {project.status !== "COMPLETED" && (
                          <DropdownMenuItem onClick={() => handleStatusChange(project.id, "COMPLETED")}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        {canDelete ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(project.id)}>
                              Delete
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {visibleCardColumns.map((column) => (
                    <div key={`${project.id}-${column.key}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {column.label}
                      </p>
                      <div className={column.cellClassName ? `mt-1 text-sm ${column.cellClassName}` : "mt-1 text-sm text-slate-900"}>
                        {column.render(project)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleColumns.map((column) => (
                  <TableHead key={column.key} className={column.headerClassName}>
                    {column.label}
                  </TableHead>
                ))}
                {showActionsColumn ? (
                  <TableHead className="sticky right-0 z-10 w-[56px] bg-white px-2 text-right">
                    {showColumnPicker ? (
                      <Popover open={isColumnPickerOpen} onOpenChange={setIsColumnPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Choose visible project fields"
                          >
                            <SlidersHorizontal className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-[260px] p-0">
                          <div className="border-b border-slate-200 px-4 py-3 text-left">
                            <p className="text-sm font-semibold text-slate-900">List Fields</p>
                            <p className="text-xs text-slate-500">Choose which project details to show.</p>
                          </div>
                          <div className="max-h-[420px] space-y-1 overflow-y-auto px-2 py-2">
                            {PROJECT_COLUMN_OPTIONS.map((column) => {
                              const checked = visibleColumnKeys.includes(column.key);
                              const isOnlySelected = checked && visibleColumnKeys.length === 1;

                              return (
                                <label
                                  key={column.key}
                                  className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-900 hover:bg-slate-50 ${isOnlySelected ? "cursor-not-allowed opacity-60" : ""}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isOnlySelected}
                                    onChange={(event) => toggleColumn(column.key, event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                                  />
                                  <span>{column.label}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                            Selections save automatically.
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + (showActionsColumn ? 1 : 0)} className="py-8 text-center text-muted-foreground">
                    No projects found
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project) => (
                  <TableRow key={project.id}>
                    {visibleColumns.map((column) => (
                      <TableCell key={`${project.id}-${column.key}`} className={column.cellClassName}>
                        {column.render(project)}
                      </TableCell>
                    ))}
                    {showActionsColumn ? (
                      <TableCell className="sticky right-0 bg-white text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {showTlDetailsMenu && !canManage ? (
                              <DropdownMenuItem asChild>
                                <Link href={`/projects/${project.id}?view=details`}>
                                  <Settings className="mr-2 h-4 w-4" />
                                  Settings
                                </Link>
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/projects/${project.id}?view=details`}>
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                  </Link>
                                </DropdownMenuItem>
                                {canEditProject ? (
                                  <DropdownMenuItem onClick={() => onEditProject?.(project)}>
                                    Edit
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                {project.status !== "IN_PROGRESS" && project.status !== "COMPLETED" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(project.id, "IN_PROGRESS")}>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Project
                                  </DropdownMenuItem>
                                )}
                                {project.status === "IN_PROGRESS" && (
                                  <DropdownMenuItem onClick={() => setHoldProjectId(project.id)}>
                                    <Pause className="mr-2 h-4 w-4" />
                                    Put on Hold
                                  </DropdownMenuItem>
                                )}
                                {project.status !== "COMPLETED" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(project.id, "COMPLETED")}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark Complete
                                  </DropdownMenuItem>
                                )}
                                {canDelete ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-600" onClick={() => setDeleteId(project.id)}>
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the project and its related data.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <HoldDialog
        projectId={holdProjectId}
        open={!!holdProjectId}
        onOpenChange={() => setHoldProjectId(null)}
      />
    </>
  );
}
