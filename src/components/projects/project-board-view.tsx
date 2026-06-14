"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  Clock3,
  Download,
  Flag,
  LayoutGrid,
  List,
  MoreHorizontal,
  PanelLeft,
  PanelsTopLeft,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Star,
  Table2,
  TimerReset,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Priority, ProjectStatus, ProjectType, Role } from "@prisma/client";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjectKanban } from "./project-kanban";
import { ProjectTable } from "./project-table";
import { ProjectForm } from "./project-form";
import { ProjectImportDialog } from "./project-import-dialog";
import { ProjectSearchFilterBar } from "./project-search-filter-bar";
import { ProjectsWorkflowView } from "./projects-workflow-view";
import {
  createDefaultProjectAdvancedFilters,
  createDefaultTaskAdvancedFilters,
  applyProjectTaskBoardFilters,
  applyProjectBoardFilters,
  ProjectAdvancedFilters,
  ProjectFilterKey,
  ProjectGroupByKey,
  TaskAdvancedFilters,
} from "@/lib/project-board-filters";
import {
  ProjectTask,
  DEFAULT_TASK_STAGE_OPTIONS,
  type DefaultTaskStageKey,
  getTaskPriorityLevel,
  getTaskPriorityLabel,
  getTaskStageKey,
  getTaskStageLabel,
  getTaskStatus,
  normalizeTask,
} from "@/lib/project-task-utils";
import { toast } from "sonner";
import type { ProjectClientOption, ProjectClientRecord } from "@/lib/project-client-types";
import {
  DEFAULT_PROJECT_EXPORT_FIELD_KEYS,
  PROJECT_EXPORT_FIELD_OPTIONS,
  readStoredProjectExportFieldKeys,
} from "@/lib/project-export-settings";

interface Project {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  clientId?: string | null;
  client?: ProjectClientRecord | null;
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
  stageId: string | null;
  stage: { id: string; name: string; sortOrder: number } | null;
  manager: { id: string; name: string } | null;
  assignments: { user: { id: string; name: string; role: Role } }[];
  _count: { timeEntries: number };
  taskCount: number;
}

interface Stage {
  id: string;
  name: string;
  sortOrder: number;
}

interface AggregatedProjectTask extends ProjectTask {
  projectId: string;
  projectName: string;
  projectCategory: string;
  projectType: ProjectType;
  managerName: string | null;
  assigneeName: string;
  stageName: string;
  stageBucketId: DefaultTaskStageKey;
}

interface AllTasksKanbanColumn {
  stageId: DefaultTaskStageKey;
  stageName: string;
  tasks: AggregatedProjectTask[];
}

const ALL_TASKS_KANBAN_STAGE_ORDER_STORAGE_KEY = "project-board-all-tasks-stage-order";
const DEFAULT_TASK_STAGE_ORDER = new Map(
  DEFAULT_TASK_STAGE_OPTIONS.map((stage, index) => [stage.id, index])
);

function reorderProjectIds(projectIds: string[], draggedProjectId: string, targetProjectId: string) {
  if (draggedProjectId === targetProjectId) {
    return projectIds;
  }

  const nextProjectIds = [...projectIds];
  const draggedIndex = nextProjectIds.indexOf(draggedProjectId);
  const targetIndex = nextProjectIds.indexOf(targetProjectId);

  if (draggedIndex === -1 || targetIndex === -1) {
    return projectIds;
  }

  nextProjectIds.splice(draggedIndex, 1);
  nextProjectIds.splice(targetIndex, 0, draggedProjectId);
  return nextProjectIds;
}

function mergeProjectOrder(projectIds: string[], availableProjectIds: string[]) {
  const filtered = projectIds.filter((projectId) => availableProjectIds.includes(projectId));
  const missing = availableProjectIds.filter((projectId) => !filtered.includes(projectId));
  return [...filtered, ...missing];
}

function getProjectCategoryLabel(project: Pick<Project, "serviceName" | "tags" | "type">) {
  const serviceName = project.serviceName?.trim();
  if (serviceName) {
    return serviceName;
  }

  const firstTag = project.tags
    ?.split(",")
    .map((item) => item.trim())
    .find(Boolean);

  if (firstTag) {
    return firstTag;
  }

  return project.type === "TEAM" ? "Team Project" : "Individual Project";
}

function getProjectLeadName(project: Pick<Project, "manager" | "assignments">) {
  const assignedTeamLeader = project.assignments.find((assignment) => assignment.user.role === "TEAMLEADER")?.user;
  return assignedTeamLeader?.name ?? project.manager?.name ?? project.assignments[0]?.user.name ?? "Unassigned";
}

function getProjectStageLabel(project: Pick<Project, "stage">) {
  return project.stage?.name?.trim() || "Unassigned";
}

function escapeProjectCsvValue(value: string | number | null | undefined) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

function normalizeLookupValue(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function formatExportDate(value?: Date | null) {
  return value ? format(new Date(value), "yyyy-MM-dd") : "";
}

const exportCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatExportCurrency(value?: number | null) {
  return value == null ? "" : exportCurrencyFormatter.format(value);
}

function resolveProjectClient(project: Project, projectClients: ProjectClientOption[]) {
  const projectName = normalizeLookupValue(project.name);
  const serviceName = normalizeLookupValue(project.serviceName);

  const exactMatch = projectClients.find(
    (client) =>
      client.linkedClientId === project.clientId ||
      client.id === project.clientId
  );

  if (exactMatch) {
    return exactMatch;
  }

  return (
    projectClients.find((client) => {
      const candidateNames = [
        client.projectName,
        client.sourceTitle,
        client.serviceName,
        client.name,
      ].map((value) => normalizeLookupValue(value));

      return (
        candidateNames.includes(projectName) ||
        (serviceName ? candidateNames.includes(serviceName) : false)
      );
    }) ?? null
  );
}

function getProjectTeamLeaderName(project: Pick<Project, "manager" | "assignments">) {
  const assignedTeamLeader = project.assignments.find((assignment) => assignment.user.role === "TEAMLEADER")?.user;
  return assignedTeamLeader?.name ?? project.manager?.name ?? project.assignments[0]?.user.name ?? "Unassigned";
}

function getProjectTeamMembersLabel(project: Pick<Project, "assignments">) {
  if (project.assignments.length === 0) {
    return "";
  }

  return project.assignments
    .map((assignment) => {
      const roleLabel = assignment.user.role.replaceAll("_", " ");
      return `${assignment.user.name} (${roleLabel})`;
    })
    .join("; ");
}

interface ProjectBoardViewProps {
  projects: Project[];
  stages: Stage[];
  canManageProjects: boolean;
  canEditKanban: boolean;
  canCreateStages?: boolean;
  canUpdateStages?: boolean;
  canDeleteStages?: boolean;
  canEditProjects?: boolean;
  canDeleteProjects?: boolean;
  canCreateProjects?: boolean;
  projectManagers?: { id: string; name: string; role?: string; email?: string | null }[];
  projectClients?: ProjectClientOption[];
  showTlDetailsMenu?: boolean;
}

type ProjectBoardContentView =
  | "projects"
  | "allTasks"
  | "tasksAnalysis"
  | "milestones"
  | "sprints";

function resolveProjectBoardContentView(view: string | null): ProjectBoardContentView {
  if (view === "allTasks") {
    return "allTasks";
  }
  if (view === "tasksAnalysis") {
    return "tasksAnalysis";
  }
  if (view === "milestones") {
    return "milestones";
  }
  if (view === "sprints") {
    return "sprints";
  }

  return "projects";
}

export function ProjectBoardView({
  projects,
  stages,
  canManageProjects,
  canEditKanban,
  canCreateStages = false,
  canUpdateStages = false,
  canDeleteStages = false,
  canEditProjects = false,
  canDeleteProjects = false,
  canCreateProjects = false,
  projectManagers = [],
  projectClients = [],
  showTlDetailsMenu = false,
}: ProjectBoardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const contentView = resolveProjectBoardContentView(searchParams.get("view"));
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMenuOpen, setIsSearchMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ProjectFilterKey>("all");
  const [activeGroupBy, setActiveGroupBy] = useState<ProjectGroupByKey>("none");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [allProjectTasks, setAllProjectTasks] = useState<AggregatedProjectTask[]>([]);
  const [isAllTasksLoading, setIsAllTasksLoading] = useState(false);
  const [selectedAllTask, setSelectedAllTask] = useState<AggregatedProjectTask | null>(null);
  const [selectedAllTaskIds, setSelectedAllTaskIds] = useState<string[]>([]);
  const [collapsedAllTaskProjectIds, setCollapsedAllTaskProjectIds] = useState<string[]>([]);
  const [allTasksPage, setAllTasksPage] = useState(0);
  const [allTasksViewMode, setAllTasksViewMode] = useState<
    "list" | "kanban" | "calendar" | "activity" | "map" | "timeline" | "grid" | "chart"
  >("kanban");
  const [allTasksStageOrder, setAllTasksStageOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    const storedValue = window.localStorage.getItem(ALL_TASKS_KANBAN_STAGE_ORDER_STORAGE_KEY);
    if (!storedValue) return [];

    try {
      const parsed = JSON.parse(storedValue);
      return Array.isArray(parsed) && parsed.every((value) => typeof value === "string")
        ? parsed
        : [];
    } catch {
      window.localStorage.removeItem(ALL_TASKS_KANBAN_STAGE_ORDER_STORAGE_KEY);
      return [];
    }
  });
  const [draggedAllTasksStageId, setDraggedAllTasksStageId] = useState<string | null>(null);
  const [dragOverAllTasksStageId, setDragOverAllTasksStageId] = useState<string | null>(null);
  const [projectAdvancedFilters, setProjectAdvancedFilters] = useState<ProjectAdvancedFilters>(
    createDefaultProjectAdvancedFilters
  );
  const [taskAdvancedFilters, setTaskAdvancedFilters] = useState<TaskAdvancedFilters>(
    createDefaultTaskAdvancedFilters
  );

  const allTasksPageSize = 20;

  const handleExportProjects = () => {
    if (filteredProjects.length === 0) {
      toast.error("No projects available to export");
      return;
    }

    const selectedFieldKeys = readStoredProjectExportFieldKeys();
    const exportFieldOptions =
      selectedFieldKeys.length > 0
        ? PROJECT_EXPORT_FIELD_OPTIONS.filter((field) => selectedFieldKeys.includes(field.key))
        : PROJECT_EXPORT_FIELD_OPTIONS.filter((field) => DEFAULT_PROJECT_EXPORT_FIELD_KEYS.includes(field.key));

    const csvHeaders = exportFieldOptions.map((field) => field.label);

    const csvRows = filteredProjects.map((project) => {
      const projectClient = resolveProjectClient(project, projectClients);
      const client = project.client ?? projectClient;
      const teamLeaderName = getProjectTeamLeaderName(project);
      const teamMembersLabel = getProjectTeamMembersLabel(project);
      const exportRow: Record<string, string | number> = {
        projectName: project.name,
        code: project.code,
        clientName: client?.name ?? "",
        clientCollege: client?.collegeName ?? "",
        clientEmail: client?.email ?? "",
        clientPhone: client?.phone ?? "",
        clientStreet: client?.street ?? "",
        clientAddress: client?.address ?? "",
        clientCity: client?.city ?? "",
        clientZip: client?.zip ?? "",
        clientState: client?.state ?? "",
        clientCountry: client?.country ?? "",
        clientService: client?.serviceName ?? project.serviceName ?? "",
        clientProjectName: client?.projectName ?? "",
        clientTags: client?.tags ?? "",
        clientNotes: client?.notes ?? "",
        clientStatus: client ? (client.isActive ? "Active" : "Inactive") : "",
        clientQuotationNo: projectClient?.quotationNo ?? "",
        clientSourceTitle: projectClient?.sourceTitle ?? "",
        category: getProjectCategoryLabel(project),
        teamLeader: teamLeaderName,
        manager: project.manager?.name ?? "",
        stage: project.stage?.name ?? "",
        status: project.status.replaceAll("_", " "),
        priority: project.priority,
        progress: `${project.progress}%`,
        startDate: formatExportDate(project.startDate),
        expectedClosingDate: formatExportDate(project.expectedClosingDate),
        deadline: formatExportDate(project.deadline),
        estimatedHours: project.estimatedHours == null ? "" : project.estimatedHours,
        unitName: project.unitName ?? "",
        unitCount: project.unitCount == null ? "" : project.unitCount,
        unitPrice: formatExportCurrency(project.unitPrice),
        costPerUnit: formatExportCurrency(project.costPerUnit),
        subtotal: formatExportCurrency(project.subtotalAmount),
        gstPercent: project.gstPercent == null ? "" : `${Number(project.gstPercent).toFixed(2)}%`,
        gstAmount: formatExportCurrency(project.gstAmount),
        finalAmount: formatExportCurrency(project.finalAmount),
        profit: formatExportCurrency(project.profitAmount),
        invoicingPolicy: project.invoicingPolicy ?? "",
        taskCount: project.taskCount,
        timeEntries: project._count.timeEntries,
        tags: project.tags ?? "",
        teamMembers: teamMembersLabel,
      };

      return exportFieldOptions.map((field) => exportRow[field.key]);
    });

    const csvContent = [
      csvHeaders.map((header) => escapeProjectCsvValue(header)).join(","),
      ...csvRows.map((row) => row.map((cell) => escapeProjectCsvValue(cell)).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `projects-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Projects exported successfully");
  };

  const handleOpenMilestones = () => {
    router.push("/projects?view=milestones");
  };

  const handleOpenSprints = () => {
    router.push("/projects?view=sprints");
  };

  const handleOpenProjects = () => {
    router.push("/projects");
  };

  const projectFilterableProjects = useMemo(
    () =>
      projects.map((project) => {
        const projectClient = resolveProjectClient(project, projectClients);

        return {
          ...project,
          quotationNo: projectClient?.quotationNo ?? null,
          sourceTitle: projectClient?.sourceTitle ?? null,
          projectCategory: getProjectCategoryLabel(project),
          managerName: getProjectLeadName(project),
          stageName: getProjectStageLabel(project),
          stageSortOrder: project.stage?.sortOrder ?? Number.MAX_SAFE_INTEGER,
        };
      }),
    [projects, projectClients]
  );
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- derived list is intentionally memoized for rendering and export
  const filteredProjects = useMemo(() => {
    return applyProjectBoardFilters(
      projectFilterableProjects,
      searchQuery,
      activeFilter,
      activeGroupBy,
      projectAdvancedFilters
    );
  }, [projectAdvancedFilters, projectFilterableProjects, searchQuery, activeFilter, activeGroupBy]);
  const filteredAllProjectTasks = useMemo(() => {
    return applyProjectTaskBoardFilters(
      allProjectTasks.map((task) => ({
        ...task,
        priorityLevel: getTaskPriorityLevel(task),
        taskStatus: getTaskStatus(task),
      })),
      searchQuery,
      activeFilter,
      activeGroupBy,
      taskAdvancedFilters
    );
  }, [allProjectTasks, searchQuery, activeFilter, activeGroupBy, taskAdvancedFilters]);
  const allTaskProjectCategories = useMemo(
    () =>
      Array.from(
        new Set(allProjectTasks.map((task) => task.projectCategory?.trim() || "Uncategorized"))
      ).sort((left, right) => left.localeCompare(right)),
    [allProjectTasks]
  );
  const allTaskStatusValues = useMemo(
    () =>
      Array.from(new Set(allProjectTasks.map((task) => getTaskStatus(task)))).sort((left, right) => {
        const weight = (value: string) => {
          if (value === "TODO") return 0;
          if (value === "IN_PROGRESS") return 1;
          if (value === "DONE") return 2;
          return 3;
        };

        return weight(left) - weight(right) || left.localeCompare(right);
      }),
    [allProjectTasks]
  );
  const allTaskPriorityLevels = useMemo(
    () =>
      Array.from(new Set(allProjectTasks.map((task) => getTaskPriorityLevel(task)))).sort(
        (left, right) => right - left
      ),
    [allProjectTasks]
  );
  const allTaskAssigneeNames = useMemo(
    () =>
      Array.from(new Set(allProjectTasks.map((task) => task.assigneeName?.trim() || "Unassigned"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [allProjectTasks]
  );
  const allTaskStageNames = useMemo(
    () =>
      Array.from(new Set(allProjectTasks.map((task) => task.stageName?.trim() || "To Do"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [allProjectTasks]
  );
  const allTasksFilterConfig = useMemo(
    () => ({
      filters: taskAdvancedFilters,
      onChange: setTaskAdvancedFilters,
      options: {
        projectCategories: allTaskProjectCategories,
        statuses: allTaskStatusValues,
        priorities: allTaskPriorityLevels,
        assignees: allTaskAssigneeNames,
        stages: allTaskStageNames,
      },
    }),
    [
      allTaskAssigneeNames,
      allTaskPriorityLevels,
      allTaskProjectCategories,
      allTaskStageNames,
      allTaskStatusValues,
      taskAdvancedFilters,
    ]
  );
  const projectCategories = useMemo(
    () =>
      Array.from(new Set(projectFilterableProjects.map((project) => project.projectCategory || "Uncategorized"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [projectFilterableProjects]
  );
  const projectStatusValues = useMemo(
    () =>
      Array.from(new Set(projectFilterableProjects.map((project) => project.status))).sort((left, right) => {
        const weight = (value: ProjectStatus) => {
          if (value === "PLANNING") return 0;
          if (value === "IN_PROGRESS") return 1;
          if (value === "ON_HOLD") return 2;
          if (value === "COMPLETED") return 3;
          if (value === "CANCELLED") return 4;
          return 5;
        };

        return weight(left) - weight(right) || left.localeCompare(right);
      }),
    [projectFilterableProjects]
  );
  const projectPriorityValues = useMemo(
    () =>
      Array.from(new Set(projectFilterableProjects.map((project) => project.priority))).sort((left, right) => {
        const weight = (value: Priority) => {
          if (value === "CRITICAL") return 0;
          if (value === "HIGH") return 1;
          if (value === "MEDIUM") return 2;
          if (value === "LOW") return 3;
          return 4;
        };

        return weight(left) - weight(right) || left.localeCompare(right);
      }),
    [projectFilterableProjects]
  );
  const projectManagerValues = useMemo(
    () =>
      Array.from(new Set(projectFilterableProjects.map((project) => project.managerName?.trim() || "Unassigned"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [projectFilterableProjects]
  );
  const projectStageValues = useMemo(
    () =>
      Array.from(new Set(projectFilterableProjects.map((project) => project.stageName?.trim() || "Unassigned"))).sort(
        (left, right) => left.localeCompare(right)
      ),
    [projectFilterableProjects]
  );
  const projectFilterConfig = useMemo(
    () => ({
      filters: projectAdvancedFilters,
      onChange: setProjectAdvancedFilters,
      options: {
        projectCategories,
        statuses: projectStatusValues,
        priorities: projectPriorityValues,
        managers: projectManagerValues,
        stages: projectStageValues,
      },
    }),
    [
      projectAdvancedFilters,
      projectCategories,
      projectManagerValues,
      projectPriorityValues,
      projectStageValues,
      projectStatusValues,
    ]
  );
  const hasAdvancedProjectFilters =
    projectAdvancedFilters.projectCategories.length > 0 ||
    projectAdvancedFilters.statuses.length > 0 ||
    projectAdvancedFilters.priorities.length > 0 ||
    projectAdvancedFilters.managers.length > 0 ||
    projectAdvancedFilters.stages.length > 0 ||
    projectAdvancedFilters.dueState !== "all";
  const hasAdvancedTaskFilters =
    taskAdvancedFilters.projectCategories.length > 0 ||
    taskAdvancedFilters.statuses.length > 0 ||
    taskAdvancedFilters.priorities.length > 0 ||
    taskAdvancedFilters.assignees.length > 0 ||
    taskAdvancedFilters.stages.length > 0 ||
    taskAdvancedFilters.dueState !== "all";
  const hasActiveToolbarFilters =
    activeFilter !== "all" ||
    activeGroupBy !== "none" ||
    (contentView === "projects" && hasAdvancedProjectFilters) ||
    (contentView === "allTasks" && hasAdvancedTaskFilters);

  const availableAllTasksStageIds = useMemo(
    () => DEFAULT_TASK_STAGE_OPTIONS.map((stage) => stage.id),
    []
  );
  const effectiveAllTasksStageOrder = useMemo(
    () => mergeProjectOrder(allTasksStageOrder, availableAllTasksStageIds),
    [allTasksStageOrder, availableAllTasksStageIds]
  );
  const allTasksKanbanColumns = useMemo<AllTasksKanbanColumn[]>(() => {
    const grouped = new Map<DefaultTaskStageKey, AggregatedProjectTask[]>();
    for (const stage of DEFAULT_TASK_STAGE_OPTIONS) {
      grouped.set(stage.id, []);
    }

    for (const task of filteredAllProjectTasks) {
      grouped.get(task.stageBucketId)?.push(task);
    }

    const orderLookup = new Map(
      effectiveAllTasksStageOrder.map((stageId, index) => [stageId, index])
    );

    return DEFAULT_TASK_STAGE_OPTIONS
      .map((stage) => ({
        stageId: stage.id,
        stageName: stage.name,
        tasks: grouped.get(stage.id) ?? [],
      }))
      .sort((left, right) => {
        const leftOrder = orderLookup.get(left.stageId) ?? DEFAULT_TASK_STAGE_ORDER.get(left.stageId) ?? 0;
        const rightOrder = orderLookup.get(right.stageId) ?? DEFAULT_TASK_STAGE_ORDER.get(right.stageId) ?? 0;
        return leftOrder - rightOrder;
      });
  }, [filteredAllProjectTasks, effectiveAllTasksStageOrder]);
  const allTasksCalendarColumns = useMemo(() => {
    const withDueDate = filteredAllProjectTasks.filter((task) => task.dueDate);
    const grouped = new Map<string, AggregatedProjectTask[]>();

    for (const task of withDueDate) {
      const key = format(new Date(task.dueDate as string), "yyyy-MM-dd");
      const current = grouped.get(key) ?? [];
      current.push(task);
      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([dateKey, tasks]) => ({
        dateKey,
        label: format(new Date(dateKey), "EEE, dd MMM"),
        tasks,
      }));
  }, [filteredAllProjectTasks]);
  const tasksAnalysisData = useMemo(() => {
    const grouped = new Map<string, number>();

    for (const task of allProjectTasks) {
      grouped.set(task.projectName, (grouped.get(task.projectName) ?? 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([projectName, count], index) => ({
        projectName,
        count,
        fill: ["#5aa2e6", "#e85d75", "#17b897", "#f59e0b", "#8b5cf6"][index % 5],
      }))
      .sort((a, b) => b.count - a.count);
  }, [allProjectTasks]);
  const allTasksTotalPages = Math.max(1, Math.ceil(filteredAllProjectTasks.length / allTasksPageSize));
  const safeAllTasksPage = Math.min(allTasksPage, allTasksTotalPages - 1);
  const paginatedAllTasks = useMemo(() => {
    const startIndex = safeAllTasksPage * allTasksPageSize;
    return filteredAllProjectTasks.slice(startIndex, startIndex + allTasksPageSize);
  }, [filteredAllProjectTasks, safeAllTasksPage]);
  const paginatedAllTaskSections = useMemo(() => {
    const grouped = new Map<
      string,
      { projectId: string; projectName: string; tasks: AggregatedProjectTask[] }
    >();

    for (const task of paginatedAllTasks) {
      const existing = grouped.get(task.projectId);

      if (existing) {
        existing.tasks.push(task);
        continue;
      }

      grouped.set(task.projectId, {
        projectId: task.projectId,
        projectName: task.projectName,
        tasks: [task],
      });
    }

    return Array.from(grouped.values());
  }, [paginatedAllTasks]);
  const allTasksPageStart =
    filteredAllProjectTasks.length === 0 ? 0 : safeAllTasksPage * allTasksPageSize + 1;
  const allTasksPageEnd = Math.min((safeAllTasksPage + 1) * allTasksPageSize, filteredAllProjectTasks.length);
  const allTasksAllSelected =
    paginatedAllTasks.length > 0 &&
    paginatedAllTasks.every((task) => selectedAllTaskIds.includes(task.id));
  const visibleSelectedAllTask = useMemo(() => {
    if (!selectedAllTask) return null;
    return filteredAllProjectTasks.find((task) => task.id === selectedAllTask.id) ?? null;
  }, [filteredAllProjectTasks, selectedAllTask]);
  const collapsedAllTaskProjectIdSet = useMemo(
    () => new Set(collapsedAllTaskProjectIds),
    [collapsedAllTaskProjectIds]
  );

  const toggleAllTasksRowSelection = (taskId: string) => {
    setSelectedAllTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  };

  const toggleAllTasksProjectSection = (projectId: string) => {
    setCollapsedAllTaskProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId]
    );
  };

  const toggleSelectAllTasks = () => {
    setSelectedAllTaskIds((current) =>
      allTasksAllSelected
        ? current.filter((id) => !paginatedAllTasks.some((task) => task.id === id))
        : Array.from(new Set([...current, ...paginatedAllTasks.map((task) => task.id)]))
    );
  };

  useEffect(() => {
    if (typeof window === "undefined" || effectiveAllTasksStageOrder.length === 0) return;

    window.localStorage.setItem(
      ALL_TASKS_KANBAN_STAGE_ORDER_STORAGE_KEY,
      JSON.stringify(effectiveAllTasksStageOrder)
    );
  }, [effectiveAllTasksStageOrder]);

  useEffect(() => {
    if (contentView !== "allTasks" && contentView !== "tasksAnalysis") return;

    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state tracks the async task fetch lifecycle
    setIsAllTasksLoading(true);

    Promise.all(
      projects.map(async (project) => {
        const result = await getProjectTasks(project.id);
        if (result.error) {
          return [] as AggregatedProjectTask[];
        }

        const assigneeMap = new Map(
          project.assignments.map((assignment) => [assignment.user.id, assignment.user.name])
        );
        const orderedStages = (result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
        const firstStageId = orderedStages[0]?.id;
        const lastStageId = orderedStages[orderedStages.length - 1]?.id;

        return (result.data ?? [])
          .map(normalizeTask)
          .filter((task): task is ProjectTask => Boolean(task))
          .map((task) => {
            const resolvedStageName =
              orderedStages.find((stage) => stage.id === task.stageId)?.name ?? getTaskStageLabel(task);
            const stageBucketId =
              task.stageId && task.stageId === lastStageId
                ? "done"
                : task.stageId && task.stageId !== firstStageId
                  ? "in_progress"
                  : getTaskStageKey(task);

            return {
              ...task,
              projectId: project.id,
              projectName: project.name,
              projectCategory: getProjectCategoryLabel(project),
              projectType: project.type,
              managerName: project.manager?.name ?? null,
              assigneeName:
                assigneeMap.get(task.employeeAssigneeId || task.assigneeId) ??
                project.manager?.name ??
                "Unassigned",
              stageName: resolvedStageName,
              stageBucketId,
            };
          });
      })
    )
      .then((taskGroups) => {
        if (!active) return;

        setAllProjectTasks(
          taskGroups.flat().sort((a, b) => {
            const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
            return aDate - bDate;
          })
        );
        setAllTasksPage(0);
      })
      .finally(() => {
        if (active) {
          setIsAllTasksLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [contentView, projects]);

  return (
    <Tabs
      value={viewMode}
      onValueChange={(value) => setViewMode(value as "kanban" | "table")}
      className="flex h-[calc(100dvh-7rem)] min-h-0 flex-1 flex-col gap-1 overflow-hidden md:h-[calc(100dvh-7.75rem)]"
    >
      <div className="sticky top-0 z-30">
        <div className="rounded-xl border bg-card/95 p-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90 md:p-3">
          <div
            className={`flex flex-wrap items-center justify-between gap-2.5 ${
              contentView !== "tasksAnalysis" && contentView !== "milestones" && contentView !== "sprints"
                ? "xl:flex-nowrap"
                : ""
            }`}
          >
          <div
            className={`min-h-9 flex flex-wrap items-center gap-2.5 ${
              contentView !== "tasksAnalysis" && contentView !== "milestones" && contentView !== "sprints"
                ? "shrink-0"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {contentView === "allTasks" ? (
                <>
                  <Button
                    size="sm"
                    className="h-9 rounded-lg bg-[#44a2de] px-4 text-sm font-semibold text-white hover:bg-[#3991ca]"
                  >
                    New
                  </Button>
                  <h1 className="text-[1.25rem] font-semibold tracking-tight text-foreground md:text-[1.45rem]">
                    All Tasks
                  </h1>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => router.push("/settings")}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              ) : contentView === "tasksAnalysis" ? (
                <>
                  <h1 className="text-[1.2rem] font-semibold tracking-tight text-foreground md:text-[1.35rem]">
                    Tasks Analysis
                  </h1>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => router.push("/settings")}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </>
              ) : contentView === "milestones" || contentView === "sprints" ? (
                <>
                  <h1 className="text-[1.2rem] font-semibold tracking-tight text-foreground md:text-[1.35rem]">
                    {contentView === "milestones" ? "Milestones" : "Sprints"}
                  </h1>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Open workflow menu"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-52">
                      <DropdownMenuItem onClick={handleOpenProjects}>
                        <LayoutGrid className="mr-2 h-4 w-4" />
                        Projects
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenMilestones}>
                        <Flag className="mr-2 h-4 w-4" />
                        Milestones
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleOpenSprints}>
                        <TimerReset className="mr-2 h-4 w-4" />
                        Sprints
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  {canCreateProjects ? (
                    <Button size="sm" className="h-9 rounded-lg px-3" onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      New Project
                    </Button>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-tight text-foreground">Projects</h1>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          aria-label="Open project import and export menu"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52">
                        <DropdownMenuItem onClick={() => router.push("/settings")}>
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleOpenMilestones}>
                          <Flag className="mr-2 h-4 w-4" />
                          Milestones
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleOpenSprints}>
                          <TimerReset className="mr-2 h-4 w-4" />
                          Sprints
                        </DropdownMenuItem>
                        {canCreateProjects ? (
                          <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import records
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem onClick={handleExportProjects}>
                          <Download className="mr-2 h-4 w-4" />
                          Export records
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            className={`flex min-w-0 flex-wrap items-center gap-3 xl:flex-nowrap ${
              contentView !== "tasksAnalysis" && contentView !== "milestones" && contentView !== "sprints"
                ? "flex-1 justify-end"
                : ""
            }`}
          >
            {contentView === "projects" || contentView === "allTasks" ? (
              <div
                className={`min-w-0 w-full xl:ml-auto ${
                  hasActiveToolbarFilters ? "xl:max-w-[920px]" : "xl:max-w-[680px]"
                }`}
              >
                <ProjectSearchFilterBar
                  mode={contentView === "allTasks" ? "allTasks" : "projects"}
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  isSearchMenuOpen={isSearchMenuOpen}
                  onSearchMenuOpenChange={setIsSearchMenuOpen}
                  activeFilter={activeFilter}
                  onActiveFilterChange={setActiveFilter}
                  activeGroupBy={activeGroupBy}
                  onActiveGroupByChange={setActiveGroupBy}
                  onReset={() => {
                    setActiveFilter("all");
                    setActiveGroupBy("none");
                    setSearchQuery("");
                    setProjectAdvancedFilters(createDefaultProjectAdvancedFilters());
                    setTaskAdvancedFilters(createDefaultTaskAdvancedFilters());
                  }}
                  projectFilterConfig={contentView === "projects" ? projectFilterConfig : undefined}
                  taskFilterConfig={contentView === "allTasks" ? allTasksFilterConfig : undefined}
                />
              </div>
            ) : null}
            {contentView === "allTasks" ? (
              <>
                <div className="flex h-11 shrink-0 items-center text-base font-medium text-slate-700">
                  {allTasksViewMode === "list"
                    ? filteredAllProjectTasks.length > 0
                      ? `${allTasksPageStart}-${allTasksPageEnd} / ${filteredAllProjectTasks.length}`
                      : "0-0 / 0"
                    : filteredAllProjectTasks.length > 0
                      ? `1-${filteredAllProjectTasks.length} / ${filteredAllProjectTasks.length}`
                      : "0-0 / 0"}
                </div>
                <div className="inline-flex h-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAllTasksPage(Math.max(0, safeAllTasksPage - 1))}
                    disabled={allTasksViewMode !== "list" || safeAllTasksPage === 0}
                    className="h-11 w-11 rounded-none text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setAllTasksPage(Math.min(allTasksTotalPages - 1, safeAllTasksPage + 1))}
                    disabled={allTasksViewMode !== "list" || safeAllTasksPage >= allTasksTotalPages - 1}
                    className="h-11 w-11 rounded-none border-l border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="inline-flex h-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {[
                    { id: "list", icon: List, label: "List" },
                    { id: "kanban", icon: PanelsTopLeft, label: "Kanban" },
                    { id: "calendar", icon: CalendarDays, label: "Calendar" },
                    { id: "activity", icon: PanelLeft, label: "Activity" },
                    { id: "map", icon: MapPin, label: "Map" },
                    { id: "timeline", icon: RotateCcw, label: "Timeline" },
                    { id: "grid", icon: LayoutGrid, label: "Grid" },
                    { id: "chart", icon: BarChart3, label: "Chart" },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    const active = allTasksViewMode === item.id;

                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setAllTasksViewMode(item.id as typeof allTasksViewMode)}
                        className={`h-11 w-11 rounded-none ${
                          index > 0 ? "border-l border-slate-200" : ""
                        } ${
                          active
                            ? "bg-cyan-50 text-[#144a7d] shadow-[inset_0_0_0_1px_#00e5ff]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                        title={item.label}
                        aria-label={item.label}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : contentView === "tasksAnalysis" ? (
              <div className="flex items-center gap-3">
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {[
                    { id: "bar", icon: BarChart3, label: "Bar chart" },
                    { id: "trend", icon: RotateCcw, label: "Trend" },
                    { id: "grid", icon: LayoutGrid, label: "Grid" },
                  ].map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={`h-10 w-10 rounded-none ${
                          index > 0 ? "border-l border-slate-200" : ""
                        } ${
                          item.id === "bar"
                            ? "bg-cyan-50 text-[#144a7d] shadow-[inset_0_0_0_1px_#00e5ff]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                        title={item.label}
                        aria-label={item.label}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : contentView === "projects" ? (
              <TabsList className="h-10 rounded-md border bg-background p-0">
                <TabsTrigger value="kanban" className="h-10 rounded-none border-r px-4 data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                  <LayoutGrid className="h-4 w-4" />
                  <span className="sr-only">Kanban</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="h-10 rounded-none px-4 data-[state=active]:bg-secondary data-[state=active]:text-foreground">
                  <Table2 className="h-4 w-4" />
                  <span className="sr-only">List</span>
                </TabsTrigger>
              </TabsList>
            ) : null}
          </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto scroll-smooth">
      {contentView === "projects" ? (
        <>
          <TabsContent value="kanban" className="mt-0 h-full min-h-0 flex-1 overflow-hidden">
            <ProjectKanban
              projects={filteredProjects}
              stages={stages}
              groupByManager={activeGroupBy === "manager"}
              canEdit={canEditKanban}
              canCreateStages={canCreateStages}
              canUpdateStages={canUpdateStages}
              canDeleteStages={canDeleteStages}
              canEditProjects={canEditProjects}
              canDeleteProjects={canDeleteProjects}
              canAssignProjectLead={canCreateProjects}
              showTlDetailsMenu={showTlDetailsMenu}
            />
          </TabsContent>
          <TabsContent value="table" className="mt-0 min-h-0 flex-1">
            <ProjectTable
              projects={filteredProjects}
              canManage={canManageProjects}
              canEditProjects={canEditProjects}
              canDelete={canDeleteProjects}
              showTlDetailsMenu={showTlDetailsMenu}
              onEditProject={(project) => setEditingProject(project as unknown as Project)}
            />
          </TabsContent>
        </>
      ) : contentView === "milestones" || contentView === "sprints" ? (
        <div className="mt-0 min-h-0 flex-1 overflow-auto rounded-xl">
          <ProjectsWorkflowView
            canManage={canManageProjects}
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              code: project.code,
              startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
              deadline: project.deadline ? new Date(project.deadline).toISOString() : null,
              teamMembers: project.assignments.map((assignment) => ({
                id: assignment.user.id,
                name: assignment.user.name,
                role: assignment.user.role,
              })),
            }))}
            section={contentView}
          />
        </div>
      ) : contentView === "tasksAnalysis" ? (
        <div className="mt-0 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900">
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className="h-9 rounded-md bg-[#44a2de] px-3.5 text-sm font-semibold text-white hover:bg-[#3991ca]"
                >
                  Count
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 rounded-md border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Insert in Spreadsheet
                </Button>
                <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-white">
                  {[BarChart3, RotateCcw, LayoutGrid].map((Icon, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 rounded-none ${
                        index > 0 ? "border-l border-slate-200" : ""
                      } ${
                        index === 0
                          ? "bg-cyan-50 text-[#144a7d] shadow-[inset_0_0_0_1px_#00e5ff]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </div>
              <div className="text-sm text-slate-500">
                {tasksAnalysisData.length} project{tasksAnalysisData.length === 1 ? "" : "s"} analyzed
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">
              {isAllTasksLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading analysis...
                </div>
              ) : tasksAnalysisData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                  No task data available for analysis.
                </div>
              ) : (
                <div className="h-full min-h-[360px] rounded-xl border border-slate-200 bg-white p-3 sm:min-h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tasksAnalysisData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                      <CartesianGrid stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="projectName"
                        height={54}
                        tickMargin={10}
                        tick={{ fill: "#334155", fontSize: 15, fontWeight: 500 }}
                        axisLine={{ stroke: "#cbd5e1" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#475569", fontSize: 13, fontWeight: 500 }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(15,23,42,0.04)" }}
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "12px",
                          color: "#0f172a",
                          fontSize: "14px",
                        }}
                      />
                      <Legend wrapperStyle={{ color: "#475569", fontSize: "14px", paddingTop: "10px" }} />
                      <Bar
                        dataKey="count"
                        name="Tasks"
                        radius={[4, 4, 0, 0]}
                        fill="#5aa2e6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : visibleSelectedAllTask ? (
        <div className="mt-0 min-h-0 flex-1 overflow-hidden rounded-xl border bg-white">
          <div className="flex h-full min-h-0">
            <div className="flex min-w-0 flex-1 flex-col border-r border-slate-200">
              <div className="border-b border-slate-200 px-8 py-7">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">{visibleSelectedAllTask.title}</h2>
                    <div className="mt-4 flex items-center gap-3 text-slate-300">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <Star className="h-4 w-4" />
                      <Star className="h-4 w-4" />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-slate-500 hover:text-slate-900"
                    onClick={() => setSelectedAllTask(null)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="border-b border-slate-200 px-8 py-5">
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full border border-cyan-500 px-4 py-1.5 text-xs font-semibold text-cyan-700">
                    {visibleSelectedAllTask.stageName}
                  </span>
                  <span className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700">
                    {getTaskStatus(visibleSelectedAllTask)}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-500">Project</p>
                    <p className="mt-3 text-lg font-semibold text-slate-900">{visibleSelectedAllTask.projectName}</p>
                    <p className="mt-7 text-sm font-semibold text-slate-500">Assignee</p>
                    <p className="mt-2 text-base text-slate-900">{visibleSelectedAllTask.assigneeName}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-500">Priority</p>
                    <p className="mt-3 text-base font-semibold text-slate-900">{getTaskPriorityLabel(visibleSelectedAllTask)}</p>
                    <p className="mt-7 text-sm font-semibold text-slate-500">Deadline</p>
                    <p className="mt-2 text-base text-slate-900">
                      {visibleSelectedAllTask.dueDate
                        ? format(new Date(visibleSelectedAllTask.dueDate), "dd MMM yyyy")
                        : "No due date"}
                    </p>
                  </div>
                </div>

                <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex items-end gap-6 border-b border-slate-200 px-6 pt-4">
                    <button
                      type="button"
                      className="border-b-2 border-fuchsia-500 pb-3 text-base font-semibold text-fuchsia-600"
                    >
                      Description
                    </button>
                    <button
                      type="button"
                      className="pb-3 text-base font-semibold text-slate-400"
                    >
                      Sub-tasks
                    </button>
                  </div>
                  <div className="p-6">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      {visibleSelectedAllTask.description || visibleSelectedAllTask.title}
                    </div>
                    <p className="mt-6 text-sm text-slate-600">
                      {visibleSelectedAllTask.description || "No extra description added yet."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="flex w-[32%] min-w-[340px] flex-col bg-[#f8fafc]">
              <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
                <Button type="button" className="h-9 bg-[#44a2de] text-sm text-white hover:bg-[#3991ca]">Send message</Button>
                <Button type="button" className="h-9 bg-[#44a2de] text-sm text-white hover:bg-[#3991ca]">Log note</Button>
                <Button type="button" className="h-9 bg-[#44a2de] text-sm text-white hover:bg-[#3991ca]">Activity</Button>
              </div>
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-xl font-semibold text-slate-700">
                    {visibleSelectedAllTask.assigneeName.charAt(0).toUpperCase()}
                  </span>
                  <div className="flex h-10 flex-1 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-500">
                    <Search className="mr-3 h-4 w-4" />
                    Activity view
                  </div>
                </div>
                <Button type="button" className="mt-4 h-9 bg-[#44a2de] text-sm text-white hover:bg-[#3991ca]">Log</Button>
              </div>
              <div className="flex-1 overflow-auto px-6 py-6">
                <p className="mb-5 text-center text-sm text-slate-400">Today</p>
                <div className="space-y-6">
                  <div className="flex gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-lg font-semibold text-slate-700">
                      {visibleSelectedAllTask.assigneeName.charAt(0).toUpperCase()}
                    </span>
                    <div className="text-sm text-slate-600">
                      <p className="text-sm font-semibold text-slate-900">
                        {visibleSelectedAllTask.assigneeName}
                        <span className="ml-2 text-sm font-normal text-slate-400">12:14 PM</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-800">{visibleSelectedAllTask.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {visibleSelectedAllTask.projectName} {"->"} {visibleSelectedAllTask.assigneeName}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-lg font-semibold text-slate-700">
                      K
                    </span>
                    <div className="text-sm text-slate-600">
                      <p className="text-sm font-semibold text-slate-900">
                        kabilan
                        <span className="ml-2 text-sm font-normal text-slate-400">11:45 AM</span>
                      </p>
                      <p className="mt-1 text-sm text-slate-800">Task created</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Assigned to {visibleSelectedAllTask.assigneeName}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="mt-0 min-h-0 flex flex-1 overflow-hidden rounded-xl border bg-card">
          <div className="min-w-0 flex-1 overflow-auto">
            {isAllTasksLoading ? (
              <div className="px-6 py-10 text-sm text-slate-500">Loading tasks...</div>
            ) : filteredAllProjectTasks.length === 0 ? (
              <div className="px-6 py-10 text-sm text-slate-500">
                {allProjectTasks.length === 0
                  ? "No tasks found across the available projects."
                  : "No tasks match the current search or filter."}
              </div>
            ) : allTasksViewMode === "kanban" ? (
              <div className="h-full overflow-auto bg-white p-4">
                <div className="flex min-w-max gap-4">
                  {allTasksKanbanColumns.map((column) => (
                    <div
                      key={column.stageId}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragOverAllTasksStageId !== column.stageId) {
                          setDragOverAllTasksStageId(column.stageId);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const droppedStageId =
                          event.dataTransfer.getData("text/plain") || draggedAllTasksStageId;

                        if (!droppedStageId || droppedStageId === column.stageId) {
                          setDraggedAllTasksStageId(null);
                          setDragOverAllTasksStageId(null);
                          return;
                        }

                        setAllTasksStageOrder((current) =>
                          reorderProjectIds(
                            mergeProjectOrder(current, availableAllTasksStageIds),
                            droppedStageId,
                            column.stageId
                          )
                        );
                        setDraggedAllTasksStageId(null);
                        setDragOverAllTasksStageId(null);
                      }}
                      onDragEnd={() => {
                        setDraggedAllTasksStageId(null);
                        setDragOverAllTasksStageId(null);
                      }}
                      className={`flex w-[300px] shrink-0 flex-col rounded-sm border border-dashed bg-white transition ${
                        dragOverAllTasksStageId === column.stageId
                          ? "border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.3)]"
                          : "border-slate-200"
                      } ${draggedAllTasksStageId === column.stageId ? "opacity-70" : ""}`}
                    >
                      <div
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData("text/plain", column.stageId);
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedAllTasksStageId(column.stageId);
                        }}
                        onDragEnd={() => {
                          setDraggedAllTasksStageId(null);
                          setDragOverAllTasksStageId(null);
                        }}
                        className="flex cursor-grab items-center justify-between border-b border-slate-200 bg-sky-50 px-3 py-2.5 active:cursor-grabbing"
                      >
                        <h3 className="truncate text-[0.9rem] font-semibold tracking-tight text-[#184d92]">
                          {column.stageName}
                        </h3>
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-200 px-2 text-xs font-semibold text-[#184d92]">
                          {column.tasks.length}
                        </span>
                      </div>
                      <div className="min-h-[200px]">
                        {column.tasks.map((task, index) => {
                          const taskProgress =
                            typeof task.progress === "number"
                              ? Math.max(0, Math.min(100, task.progress))
                              : getTaskStatus(task) === "DONE"
                                ? 100
                                : getTaskStatus(task) === "IN_PROGRESS"
                                  ? 50
                                  : 0;

                          return (
                          <button
                            key={`${task.projectId}-${task.id}`}
                            type="button"
                            onClick={() => setSelectedAllTask(task)}
                            className={`border-slate-300 px-4 py-4 text-slate-900 ${
                              index > 0 ? "border-t" : ""
                            } block w-full text-left transition hover:bg-slate-50`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[0.92rem] font-semibold text-[#0f4a94]">
                                  {task.title}
                                </div>
                              <div className="mt-1 text-[0.8rem] text-slate-500">
                                  {task.projectId.slice(0, 3).toUpperCase()}-{task.id.slice(0, 3).toUpperCase()}
                                </div>
                              </div>
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center text-[#184d92]"
                                aria-hidden="true"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </span>
                            </div>

                            <div className="mt-4 w-[74%] space-y-1">
                              <div className="flex items-center justify-between text-[0.8rem] text-[#3b6db0]">
                                <span>Progress</span>
                                <span>{taskProgress}%</span>
                              </div>
                              <Progress value={taskProgress} className="h-2 bg-rose-100" />
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-[0.82rem] text-[#3b6db0]">
                              <span>{task.stageName}</span>
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-500">
                                <Clock3 className="h-3 w-3" />
                              </span>
                            </div>
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : allTasksViewMode === "calendar" ? (
              <div className="h-full overflow-auto bg-white p-4">
                {allTasksCalendarColumns.length === 0 ? (
                  <div className="flex h-full min-h-[360px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
                    No tasks with due dates to show in calendar view.
                  </div>
                ) : (
                  <div className="grid min-w-[980px] grid-cols-3 gap-4 xl:grid-cols-4">
                    {allTasksCalendarColumns.map((day) => (
                      <div
                        key={day.dateKey}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                      >
                        <div className="border-b border-slate-200 bg-sky-50 px-4 py-3">
                          <p className="text-sm font-semibold text-[#184d92]">{day.label}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {day.tasks.length} task{day.tasks.length === 1 ? "" : "s"}
                          </p>
                        </div>
                        <div className="space-y-3 p-4">
                          {day.tasks.map((task) => (
                            <button
                              key={`${task.projectId}-${task.id}`}
                              type="button"
                              onClick={() => setSelectedAllTask(task)}
                              className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-300 hover:bg-white"
                            >
                              <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{task.projectName}</div>
                              <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                                <span>{task.assigneeName}</span>
                                <span>{task.stageName}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-0">
                {selectedAllTaskIds.length > 0 ? (
                  <div className="mx-5 mt-5 flex max-w-[560px] items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">
                    <span className="text-sm font-semibold">
                      {selectedAllTaskIds.length} selected
                    </span>
                    <div className="flex items-center gap-5">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                      <button
                        type="button"
                        className="text-red-500"
                        onClick={() => setSelectedAllTaskIds([])}
                        aria-label="Clear selection"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              <table className="min-w-full text-[13px]">
                <thead className="text-left text-slate-900">
                  <tr>
                    <th className="sticky top-0 z-20 w-12 border-b border-slate-200 bg-white px-4 py-3">
                      <button
                        type="button"
                        onClick={toggleSelectAllTasks}
                        className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                          allTasksAllSelected
                            ? "border-green-700 bg-[#44a2de] text-white"
                            : "border-slate-400 bg-white text-transparent"
                        }`}
                        aria-label="Select all tasks"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Task</th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Assignee</th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Priority</th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Due Date</th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Stage</th>
                    <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 text-xs font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAllTaskSections.map((section) => {
                    const isCollapsed = collapsedAllTaskProjectIdSet.has(section.projectId);

                    return (
                    <Fragment key={section.projectId}>
                      <tr className="border-b border-slate-200 bg-slate-50/70">
                        <td colSpan={7} className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => toggleAllTasksProjectSection(section.projectId)}
                            aria-expanded={!isCollapsed}
                            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/70"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition ${
                                  isCollapsed ? "" : "text-sky-700 shadow-sm"
                                }`}
                                aria-hidden="true"
                              >
                                <ChevronRight className={`h-4 w-4 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                              </span>
                              <p className="text-sm font-semibold text-slate-900">
                                {section.projectName}
                              </p>
                            </div>
                            <Badge variant="secondary" className="bg-slate-200 text-xs text-slate-700">
                              {section.tasks.length} task{section.tasks.length === 1 ? "" : "s"}
                            </Badge>
                          </button>
                        </td>
                      </tr>
                      {isCollapsed ? null : section.tasks.map((task) => {
                        const status = getTaskStatus(task);
                        const isSelected = selectedAllTaskIds.includes(task.id);

                        return (
                          <tr
                            key={`${task.projectId}-${task.id}`}
                            className="cursor-pointer border-b border-slate-200 transition hover:bg-slate-50"
                            onClick={() => setSelectedAllTask(task)}
                          >
                            <td className="w-12 px-4 py-3">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleAllTasksRowSelection(task.id);
                                }}
                                className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                                  isSelected
                                    ? "border-green-700 bg-[#44a2de] text-white"
                                    : "border-slate-400 bg-white text-transparent"
                                }`}
                                aria-label={`Select ${task.title}`}
                              >
                                <Check className="h-3 w-3" />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900">
                              <div className="flex items-center gap-2.5 pl-3">
                                <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
                                <p className="font-medium text-slate-900">{task.title}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{task.assigneeName}</td>
                            <td className="px-4 py-3">
                              <Badge variant="secondary" className="bg-blue-100 text-xs text-blue-800">
                                {getTaskPriorityLabel(task)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {task.dueDate ? format(new Date(task.dueDate), "dd MMM yyyy") : "No due date"}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{task.stageName}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${
                                  status === "DONE"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : status === "IN_PROGRESS"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0 sm:max-w-4xl" showCloseButton>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Create a Project</DialogTitle>
          </DialogHeader>
          <div className="min-h-[360px] p-6">
            <ProjectForm
              managers={projectManagers}
              clients={projectClients}
              compactCreate
              onSuccess={() => setIsCreateDialogOpen(false)}
              onCancel={() => setIsCreateDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl" showCloseButton>
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="p-6">
            {editingProject ? (
              <ProjectForm
                project={editingProject}
                managers={projectManagers}
                clients={projectClients}
                showStageOverview={false}
                formTitle="Edit Project"
                onSuccess={() => setEditingProject(null)}
                onCancel={() => setEditingProject(null)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <ProjectImportDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} />

    </Tabs>
  );
}
