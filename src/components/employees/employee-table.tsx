"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { addDays, addHours, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import {
  cancelEmployeeScheduledActivity,
  deleteEmployee,
  markEmployeeScheduledActivityDone,
  saveEmployeeScheduledActivity,
  toggleEmployeeStatus,
} from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { BarChart3, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3, FileText, LayoutGrid, List, Lock, Mail, MapPin, Maximize2, MoreHorizontal, Pencil, Plus, Search, Settings2, Share2, TableProperties, Tag, Trash2, UserCheck, UserX, Users, X } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  hireDate?: Date | null;
  role: Role;
  department: string | null;
  position: string | null;
  teamId: string | null;
  team: {
    id: string;
    name: string;
  } | null;
  permissions?: unknown;
  isActive: boolean;
  createdAt: Date;
  _count: {
    assignments: number;
    timeEntries: number;
  };
}

export interface EmployeeTableProps {
  employees: Employee[];
  initialScheduledActivities: ScheduledActivityItem[];
}

type EmployeeWithSummary = Employee & {
  moduleBadges: string[];
};

type EmployeeConnectionGroup = {
  id: string;
  name: string;
  leaders: EmployeeWithSummary[];
  members: EmployeeWithSummary[];
};

type ScheduledActivityItem = {
  id: string;
  ownerId: string;
  assigneeId: string;
  type: ActivityColumnKey;
  summary: string;
  dueDate: string;
  meetingTime?: string;
  meetingEndTime?: string;
  note: string;
  flow: ScheduleActivityFlow;
};

type MeetingEditorState = {
  id: string;
  ownerId: string;
  assigneeId: string;
  flow: ScheduleActivityFlow;
  summary: string;
  dueDate: string;
  meetingTime: string;
  meetingEndTime: string;
  note: string;
};

type RoleFilter = "ALL" | Role;

const roleColors: Record<Role, string> = {
  ADMIN: "bg-purple-500",
  BA: "bg-cyan-500",
  TEAMLEADER: "bg-blue-500",
  EMPLOYEE: "bg-gray-500",
};

const roleLabels: Record<Role, string> = {
  ADMIN: "Admin",
  BA: "BA",
  TEAMLEADER: "TL",
  EMPLOYEE: "Employee",
};

const moduleLabels: Record<string, string> = {
  PROJECT: "Projects",
  CRM: "CRM",
  SALES: "Sales",
};

const employeeToolbarOptions = [
  { id: "kanban", label: "Kanban view", icon: LayoutGrid },
  { id: "list", label: "List view", icon: List },
  { id: "connections", label: "Connections view", icon: Share2 },
  { id: "activity", label: "Activity view", icon: Clock3 },
  { id: "analytics", label: "Analytics view", icon: BarChart3 },
  { id: "table", label: "Table view", icon: TableProperties },
] as const;

type EmployeeToolbarView = (typeof employeeToolbarOptions)[number]["id"];

const listColumnOptions = [
  { key: "workPhone", label: "Work Phone", defaultVisible: true },
  { key: "workEmail", label: "Work Email", defaultVisible: true },
  { key: "workLocation", label: "Work Location", defaultVisible: true },
  { key: "employeeType", label: "Employee Type", defaultVisible: true },
  { key: "job", label: "Job", defaultVisible: false },
  { key: "status", label: "Status", defaultVisible: false },
  { key: "projects", label: "Projects", defaultVisible: false },
  { key: "timeEntries", label: "Time Entries", defaultVisible: false },
  { key: "moduleAccess", label: "Module Access", defaultVisible: false },
] as const;

type ListColumnKey = (typeof listColumnOptions)[number]["key"];

const activityColumnOptions = [
  { key: "todo", label: "To-Do" },
  { key: "email", label: "Email" },
  { key: "call", label: "Call" },
  { key: "meeting", label: "Meeting" },
  { key: "document", label: "Document" },
  { key: "requestSignature", label: "Request Signature" },
] as const;

type ActivityColumnKey = (typeof activityColumnOptions)[number]["key"];
type ScheduleActivityFlow = "offboarding" | "onboarding";

const scheduleDialogColumnOptions = [
  { key: "name", label: "Name" },
  { key: "workLocation", label: "Work Location" },
  { key: "contractStartDate", label: "Contract Start Date" },
  { key: "contractEndDate", label: "Contract End Date" },
  { key: "wage", label: "Wage" },
  { key: "contractType", label: "Contract Type" },
  { key: "department", label: "Department" },
  { key: "job", label: "Job" },
  { key: "manager", label: "Manager" },
  { key: "birthday", label: "Birthday" },
] as const;

type ScheduleDialogColumnKey = (typeof scheduleDialogColumnOptions)[number]["key"];

const kanbanPanelColors: Record<Role, string> = {
  ADMIN: "bg-violet-600",
  BA: "bg-cyan-600",
  TEAMLEADER: "bg-blue-600",
  EMPLOYEE: "bg-fuchsia-600",
};

const scheduleActivityTypeOptions = activityColumnOptions.filter((column) => column.key !== "requestSignature");

const MEETING_TIME_SLOTS = ["7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm"] as const;

const activityColumnStyles: Record<
  ActivityColumnKey,
  {
    bar: string;
    card: string;
    text: string;
  }
> = {
  todo: {
    bar: "bg-emerald-500",
    card: "bg-emerald-500",
    text: "text-white",
  },
  email: {
    bar: "bg-sky-500",
    card: "bg-sky-500",
    text: "text-white",
  },
  call: {
    bar: "bg-violet-500",
    card: "bg-violet-500",
    text: "text-white",
  },
  meeting: {
    bar: "bg-amber-400",
    card: "bg-amber-400",
    text: "text-slate-900",
  },
  document: {
    bar: "bg-slate-500",
    card: "bg-slate-500",
    text: "text-white",
  },
  requestSignature: {
    bar: "bg-rose-500",
    card: "bg-rose-500",
    text: "text-white",
  },
};

function getModuleAccessBadges(value: unknown) {
  const permissions = normalizeEmployeePermissions(value);
  return permissions.moduleAccess.map((module) => moduleLabels[module] ?? module);
}

function formatActivityDate(value: string, compact = false) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return compact ? `${day}/${month}/${year.slice(-2)}` : `${day}/${month}/${year}`;
}

function parseTimeLabel(timeLabel: string) {
  const hour = parseInt(timeLabel, 10);
  const suffix = timeLabel.slice(-2);

  if (suffix === "am") {
    return hour === 12 ? 0 : hour;
  }

  return hour === 12 ? 12 : hour + 12;
}

export function EmployeeTable({ employees, initialScheduledActivities }: EmployeeTableProps) {
  const [isPending, startTransition] = useTransition();
  const scheduleAssigneePickerRef = useRef<HTMLDivElement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [isScheduleActivityDialogOpen, setIsScheduleActivityDialogOpen] = useState(false);
  const [isScheduleAssigneePopoverOpen, setIsScheduleAssigneePopoverOpen] = useState(false);
  const [scheduleActivityOwnerId, setScheduleActivityOwnerId] = useState<string | null>(null);
  const [selectedScheduleEmployee, setSelectedScheduleEmployee] = useState<EmployeeWithSummary | null>(null);
  const [scheduleActivityFlow, setScheduleActivityFlow] = useState<ScheduleActivityFlow>("onboarding");
  const [selectedScheduleActivityType, setSelectedScheduleActivityType] = useState<ActivityColumnKey>("todo");
  const [scheduleActivitySummary, setScheduleActivitySummary] = useState("To-Do");
  const [scheduleActivityDueDate, setScheduleActivityDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [scheduleActivityNote, setScheduleActivityNote] = useState("");
  const [showMeetingCalendar, setShowMeetingCalendar] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingEndTime, setMeetingEndTime] = useState("11:00");
  const [meetingViewDate, setMeetingViewDate] = useState(new Date());
  const [scheduledActivities, setScheduledActivities] = useState<ScheduledActivityItem[]>(initialScheduledActivities);
  const [activeActivityPreviewId, setActiveActivityPreviewId] = useState<string | null>(null);
  const [savedScheduleActivityAssignees, setSavedScheduleActivityAssignees] = useState<Record<string, string>>(() =>
    initialScheduledActivities.reduce<Record<string, string>>((result, activity) => {
      result[activity.ownerId] = activity.assigneeId;
      return result;
    }, {})
  );
  const [savedScheduleActivityDueDates, setSavedScheduleActivityDueDates] = useState<Record<string, string>>(() =>
    initialScheduledActivities.reduce<Record<string, string>>((result, activity) => {
      result[activity.ownerId] = activity.dueDate;
      return result;
    }, {})
  );
  const [meetingEditorState, setMeetingEditorState] = useState<MeetingEditorState | null>(null);
  const [scheduleSearchTerm, setScheduleSearchTerm] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [visibleListColumns, setVisibleListColumns] = useState<ListColumnKey[]>(() =>
    listColumnOptions.filter((column) => column.defaultVisible).map((column) => column.key)
  );
  const [visibleActivityColumns, setVisibleActivityColumns] = useState<ActivityColumnKey[]>(
    () => activityColumnOptions.map((column) => column.key)
  );
  const [visibleScheduleColumns, setVisibleScheduleColumns] = useState<ScheduleDialogColumnKey[]>(
    () => scheduleDialogColumnOptions.map((column) => column.key)
  );
  const [toolbarView, setToolbarView] = useState<EmployeeToolbarView>("kanban");

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      ALL: 0,
      ADMIN: 0,
      BA: 0,
      TEAMLEADER: 0,
      EMPLOYEE: 0,
    };

    for (const employee of employees) {
      counts.ALL += 1;
      counts[employee.role] += 1;
    }

    return counts;
  }, [employees]);

  const employeesWithSummary = useMemo<EmployeeWithSummary[]>(
    () =>
      [...employees]
        .sort((a, b) => {
          const byName = a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
            numeric: true,
          });

          if (byName !== 0) {
            return byName;
          }

          return a.createdAt.getTime() - b.createdAt.getTime();
        })
        .map((employee) => ({
          ...employee,
          moduleBadges: getModuleAccessBadges(employee.permissions),
        })),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return employees
      .filter((employee) => {
        const nameMatches = !query || employee.name.toLowerCase().includes(query);
        const roleMatches = roleFilter === "ALL" || employee.role === roleFilter;
        return nameMatches && roleMatches;
      })
      .sort((a, b) => {
        const byName = a.name.localeCompare(b.name, undefined, {
          sensitivity: "base",
          numeric: true,
        });

        if (byName !== 0) {
          return byName;
        }

        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }, [employees, searchTerm, roleFilter]);

  const filteredEmployeesWithSummary = useMemo<EmployeeWithSummary[]>(
    () =>
      filteredEmployees.map((employee) => ({
        ...employee,
        moduleBadges: getModuleAccessBadges(employee.permissions),
      })),
    [filteredEmployees]
  );

  const connectionAdmins = useMemo(
    () => employeesWithSummary.filter((employee) => employee.role === "ADMIN"),
    [employeesWithSummary]
  );

  const connectionGroups = useMemo<EmployeeConnectionGroup[]>(() => {
    const groups = new Map<string, EmployeeConnectionGroup>();

    for (const employee of filteredEmployeesWithSummary) {
      if (employee.role === "ADMIN") {
        continue;
      }

      const groupId = employee.teamId ?? "unassigned";
      const existing = groups.get(groupId);
      const group =
        existing ??
        {
          id: groupId,
          name: employee.team?.name ?? "Unassigned",
          leaders: [],
          members: [],
        };

      if (employee.role === "TEAMLEADER") {
        group.leaders.push(employee);
      } else {
        group.members.push(employee);
      }

      groups.set(groupId, group);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        leaders: group.leaders.sort((a, b) => a.name.localeCompare(b.name)),
        members: group.members.sort((a, b) => {
          const byRole = roleLabels[a.role].localeCompare(roleLabels[b.role]);

          if (byRole !== 0) {
            return byRole;
          }

          return a.name.localeCompare(b.name);
        }),
      }))
      .sort((a, b) => {
        if (a.id === "unassigned") return 1;
        if (b.id === "unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [filteredEmployeesWithSummary]);

  const teamConnectionGroups = useMemo(
    () => connectionGroups.filter((group) => group.id !== "unassigned"),
    [connectionGroups]
  );

  const unassignedConnectionGroup = useMemo(
    () => connectionGroups.find((group) => group.id === "unassigned") ?? null,
    [connectionGroups]
  );

  const employeeById = useMemo(
    () => new Map(employeesWithSummary.map((employee) => [employee.id, employee])),
    [employeesWithSummary]
  );

  useEffect(() => {
    if (!isScheduleAssigneePopoverOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (scheduleAssigneePickerRef.current?.contains(event.target as Node)) return;
      setIsScheduleAssigneePopoverOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isScheduleAssigneePopoverOpen]);

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteEmployee(deleteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Employee deleted successfully");
      }
      setDeleteId(null);
    });
  };

  const handleToggleStatus = (id: string) => {
    startTransition(async () => {
      const result = await toggleEmployeeStatus(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Employee ${result.data?.isActive ? "activated" : "deactivated"} successfully`);
      }
    });
  };

  const getActivityLabel = (key: ActivityColumnKey) =>
    activityColumnOptions.find((column) => column.key === key)?.label ?? "To-Do";

  const applyMeetingDraftState = (dateValue?: string, startTime = "10:00", endTime = "11:00") => {
    if (!dateValue) {
      setMeetingDate(undefined);
      setMeetingTime(startTime);
      setMeetingEndTime(endTime);
      setMeetingViewDate(new Date());
      return;
    }

    const nextDate = new Date(`${dateValue}T${startTime}:00`);
    setMeetingDate(nextDate);
    setMeetingTime(startTime);
    setMeetingEndTime(endTime);
    setMeetingViewDate(nextDate);
  };

  const getMeetingDateTimeLabel = () => {
    if (!meetingDate) {
      return {
        date: "Choose date",
        start: "10:00 am",
        end: "11:00 am",
      };
    }

    const start = new Date(meetingDate);
    const [startHour, startMinute] = meetingTime.split(":").map(Number);
    start.setHours(startHour || 0, startMinute || 0, 0, 0);

    const end = new Date(meetingDate);
    const [endHour, endMinute] = meetingEndTime.split(":").map(Number);
    end.setHours(endHour || 0, endMinute || 0, 0, 0);

    return {
      date: format(start, "dd/MM/yyyy"),
      start: format(start, "h:mm aa").toLowerCase(),
      end: format(end, "h:mm aa").toLowerCase(),
    };
  };

  const syncMeetingDraftFromActivity = (activity: ScheduledActivityItem) => {
    const nextAssignee = employeeById.get(activity.assigneeId);

    setScheduleActivityOwnerId(activity.ownerId);
    setSelectedScheduleActivityType("meeting");
    setScheduleActivityFlow(activity.flow);
    setScheduleActivitySummary(activity.summary);
    setScheduleActivityDueDate(activity.dueDate);
    setScheduleActivityNote(activity.note);
    if (nextAssignee) {
      setSelectedScheduleEmployee(nextAssignee);
    }
    applyMeetingDraftState(
      activity.dueDate,
      activity.meetingTime ?? "10:00",
      activity.meetingEndTime ?? "11:00"
    );
  };

  const closeMeetingEventEditor = () => {
    setMeetingEditorState(null);
  };

  const openMeetingEventEditor = (activity: ScheduledActivityItem) => {
    syncMeetingDraftFromActivity(activity);
    setMeetingEditorState({
      id: activity.id,
      ownerId: activity.ownerId,
      assigneeId: activity.assigneeId,
      flow: activity.flow,
      summary: activity.summary,
      dueDate: activity.dueDate,
      meetingTime: activity.meetingTime ?? "10:00",
      meetingEndTime: activity.meetingEndTime ?? "11:00",
      note: activity.note,
    });
  };

  const handleMeetingEventEditorSave = async () => {
    if (!meetingEditorState) return;

    const normalizedSummary = meetingEditorState.summary.trim() || "Meeting";
    const normalizedDueDate = meetingEditorState.dueDate || format(new Date(), "yyyy-MM-dd");
    const nextAssignee = employeeById.get(meetingEditorState.assigneeId) ?? null;
    const nextActivity: ScheduledActivityItem = {
      id: meetingEditorState.id,
      ownerId: meetingEditorState.ownerId,
      assigneeId: meetingEditorState.assigneeId,
      type: "meeting",
      summary: normalizedSummary,
      dueDate: normalizedDueDate,
      meetingTime: meetingEditorState.meetingTime,
      meetingEndTime: meetingEditorState.meetingEndTime,
      note: meetingEditorState.note,
      flow: meetingEditorState.flow,
    };
    const result = await saveEmployeeScheduledActivity(nextActivity);

    if (!result.success) {
      toast.error("Unable to update meeting");
      return;
    }

    applyScheduledActivityLocally(result.data);

    setScheduleActivityOwnerId(meetingEditorState.ownerId);
    setSelectedScheduleActivityType("meeting");
    setScheduleActivityFlow(meetingEditorState.flow);
    setScheduleActivitySummary(normalizedSummary);
    setScheduleActivityDueDate(normalizedDueDate);
    setScheduleActivityNote(meetingEditorState.note);
    if (nextAssignee) {
      setSelectedScheduleEmployee(nextAssignee);
    }
    applyMeetingDraftState(
      normalizedDueDate,
      meetingEditorState.meetingTime,
      meetingEditorState.meetingEndTime
    );
    setMeetingEditorState(null);
    toast.success("Meeting updated");
  };

  const applyScheduleActivityDraft = (
    ownerId: string,
    type: ActivityColumnKey,
    fallbackEmployee: EmployeeWithSummary
  ) => {
    if (type !== "meeting") {
      setShowMeetingCalendar(false);
    }

    const existingActivity = scheduledActivities.find(
      (activity) => activity.ownerId === ownerId && activity.type === type
    );

    if (existingActivity) {
      const nextAssignee =
        employeesWithSummary.find((employee) => employee.id === existingActivity.assigneeId) ?? fallbackEmployee;

      setSelectedScheduleEmployee(nextAssignee);
      setScheduleActivityFlow(existingActivity.flow);
      setScheduleActivitySummary(existingActivity.summary);
      setScheduleActivityDueDate(existingActivity.dueDate);
      setScheduleActivityNote(existingActivity.note);
      if (type === "meeting") {
        applyMeetingDraftState(
          existingActivity.dueDate,
          existingActivity.meetingTime ?? "10:00",
          existingActivity.meetingEndTime ?? "11:00"
        );
      }
      return;
    }

    const savedAssignee = savedScheduleActivityAssignees[ownerId];
    const nextAssignee =
      employeesWithSummary.find((employee) => employee.id === savedAssignee) ?? fallbackEmployee;

    setSelectedScheduleEmployee(nextAssignee);
    setScheduleActivityFlow("onboarding");
    setScheduleActivitySummary(getActivityLabel(type));
    const savedDueDate = savedScheduleActivityDueDates[ownerId] ?? format(new Date(), "yyyy-MM-dd");
    setScheduleActivityDueDate(savedDueDate);
    setScheduleActivityNote("");
    if (type === "meeting") {
      applyMeetingDraftState(savedDueDate);
    }
  };

  const openScheduleDialog = () => {
    setScheduleSearchTerm("");
    setIsScheduleDialogOpen(true);
  };

  const handleScheduleEmployeeSelect = (employee: EmployeeWithSummary) => {
    setScheduleActivityOwnerId(employee.id);
    setScheduleActivityFlow("onboarding");
    setSelectedScheduleActivityType("todo");
    applyScheduleActivityDraft(employee.id, "todo", employee);
    setIsScheduleDialogOpen(false);
    setIsScheduleActivityDialogOpen(true);
  };

  const handleEmptyActivityCellSelect = (employee: EmployeeWithSummary, type: ActivityColumnKey) => {
    setScheduleActivityOwnerId(employee.id);
    setScheduleActivityFlow("onboarding");
    setSelectedScheduleActivityType(type);
    applyScheduleActivityDraft(employee.id, type, employee);
    setIsScheduleActivityDialogOpen(true);
  };

  const handleScheduleAssigneeChange = (employeeId: string) => {
    const nextAssignee = employeesWithSummary.find((employee) => employee.id === employeeId);

    if (!nextAssignee) return;

    setSelectedScheduleEmployee(nextAssignee);
    setIsScheduleAssigneePopoverOpen(false);
  };

  const handleScheduleActivityTypeChange = (type: ActivityColumnKey) => {
    setSelectedScheduleActivityType(type);

    const ownerEmployee =
      employeesWithSummary.find((employee) => employee.id === scheduleActivityOwnerId) ??
      selectedScheduleEmployee;

    if (!ownerEmployee) {
      if (type !== "meeting") {
        setShowMeetingCalendar(false);
      }
      setScheduleActivitySummary(getActivityLabel(type));
      return;
    }

    applyScheduleActivityDraft(scheduleActivityOwnerId ?? ownerEmployee.id, type, ownerEmployee);
  };

  const getActivityPreviewDateLabel = (value: string) => {
    const today = new Date();
    const targetDate = new Date(`${value}T00:00:00`);

    if (isSameDay(targetDate, today)) {
      return "Today";
    }

    if (isSameDay(targetDate, addDays(today, 1))) {
      return "Tomorrow";
    }

    return format(targetDate, "dd MMM yyyy");
  };

  const openScheduledActivityDialog = (activity: ScheduledActivityItem) => {
    const ownerEmployee = employeeById.get(activity.ownerId);

    if (!ownerEmployee) return;

    setActiveActivityPreviewId(null);
    setScheduleActivityOwnerId(activity.ownerId);
    setSelectedScheduleActivityType(activity.type);
    applyScheduleActivityDraft(activity.ownerId, activity.type, ownerEmployee);
    setIsScheduleActivityDialogOpen(true);
  };

  const handleScheduleActivityDialogChange = (open: boolean) => {
    setIsScheduleActivityDialogOpen(open);

    if (!open) {
      setMeetingEditorState(null);
      setIsScheduleAssigneePopoverOpen(false);
      setScheduleActivityOwnerId(null);
      setSelectedScheduleEmployee(null);
      setScheduleActivityDueDate(format(new Date(), "yyyy-MM-dd"));
      setScheduleActivityNote("");
      setShowMeetingCalendar(false);
      setMeetingDate(undefined);
      setMeetingTime("10:00");
      setMeetingEndTime("11:00");
      setMeetingViewDate(new Date());
    }
  };

  const applyScheduledActivityLocally = (activity: ScheduledActivityItem) => {
    setSavedScheduleActivityDueDates((current) => ({
      ...current,
      [activity.ownerId]: activity.dueDate,
    }));
    setSavedScheduleActivityAssignees((current) => ({
      ...current,
      [activity.ownerId]: activity.assigneeId,
    }));
    setScheduledActivities((current) => {
      const remainingActivities = current.filter(
        (currentActivity) => !(currentActivity.ownerId === activity.ownerId && currentActivity.type === activity.type)
      );

      return [...remainingActivities, activity];
    });
  };

  const removeScheduledActivityLocally = (ownerId: string, type: ActivityColumnKey) => {
    setScheduledActivities((current) =>
      current.filter((activity) => !(activity.ownerId === ownerId && activity.type === type))
    );
  };

  const buildScheduledActivityDraft = (): ScheduledActivityItem | null => {
    if (!selectedScheduleEmployee) {
      return null;
    }

    const activityOwnerId = scheduleActivityOwnerId ?? selectedScheduleEmployee.id;
    const normalizedSummary = scheduleActivitySummary.trim() || getActivityLabel(selectedScheduleActivityType);
    const normalizedDueDate =
      selectedScheduleActivityType === "meeting" && meetingDate
        ? format(meetingDate, "yyyy-MM-dd")
        : scheduleActivityDueDate;

    return {
      id: `${activityOwnerId}-${selectedScheduleActivityType}`,
      ownerId: activityOwnerId,
      assigneeId: selectedScheduleEmployee.id,
      type: selectedScheduleActivityType,
      summary: normalizedSummary,
      dueDate: normalizedDueDate,
      meetingTime: selectedScheduleActivityType === "meeting" ? meetingTime : undefined,
      meetingEndTime: selectedScheduleActivityType === "meeting" ? meetingEndTime : undefined,
      note: scheduleActivityNote,
      flow: scheduleActivityFlow,
    };
  };

  const persistScheduleActivityState = async () => {
    const nextActivity = buildScheduledActivityDraft();

    if (!nextActivity) {
      return null;
    }

    const result = await saveEmployeeScheduledActivity(nextActivity);

    if (!result.success) {
      toast.error("Unable to save activity");
      return null;
    }

    applyScheduledActivityLocally(result.data);
    return result.data;
  };

  const handleScheduleActivitySave = async () => {
    const savedActivity = await persistScheduleActivityState();

    if (!savedActivity || !selectedScheduleEmployee) return;

    toast.success(`Activity scheduled for ${selectedScheduleEmployee.name}`);
    handleScheduleActivityDialogChange(false);
  };

  const handleScheduleMeeting = () => {
    const nextDate =
      meetingDate ??
      (scheduleActivityDueDate
        ? new Date(`${scheduleActivityDueDate}T${meetingTime}:00`)
        : new Date());

    setMeetingDate(nextDate);
    setMeetingViewDate(nextDate);
    setScheduleActivityDueDate(format(nextDate, "yyyy-MM-dd"));
    setMeetingEditorState(null);
    setShowMeetingCalendar(true);
  };

  const handleScheduleActivityMarkDone = async () => {
    const nextActivity = buildScheduledActivityDraft();

    if (!nextActivity || !selectedScheduleEmployee) return;

    const result = await markEmployeeScheduledActivityDone(nextActivity.ownerId, nextActivity.type);

    if (!result.success) {
      toast.error(result.error ?? "Unable to mark activity done");
      return;
    }

    removeScheduledActivityLocally(nextActivity.ownerId, nextActivity.type);
    toast.success(`Activity marked done for ${selectedScheduleEmployee.name}`);
    handleScheduleActivityDialogChange(false);
  };

  const renderEmployeeActions = (employee: EmployeeWithSummary, dark = false) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          className={cn(
            "rounded-xl border border-transparent",
            dark
              ? "text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 hover:text-white"
              : "text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/employees/${employee.id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleStatus(employee.id)}>
          {employee.isActive ? (
            <>
              <UserX className="mr-2 h-4 w-4" />
              Deactivate
            </>
          ) : (
            <>
              <UserCheck className="mr-2 h-4 w-4" />
              Activate
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => setDeleteId(employee.id)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const isKanbanView = toolbarView === "kanban";
  const allVisibleSelected =
    filteredEmployeesWithSummary.length > 0 &&
    filteredEmployeesWithSummary.every((employee) => selectedEmployeeIds.includes(employee.id));

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedEmployeeIds((current) =>
        current.filter((id) => !filteredEmployeesWithSummary.some((employee) => employee.id === id))
      );
      return;
    }

    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      filteredEmployeesWithSummary.forEach((employee) => next.add(employee.id));
      return Array.from(next);
    });
  };

  const toggleSelectEmployee = (id: string) => {
    setSelectedEmployeeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const isListColumnVisible = (column: ListColumnKey) => visibleListColumns.includes(column);

  const toggleListColumn = (column: ListColumnKey) => {
    setVisibleListColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const isActivityColumnVisible = (column: ActivityColumnKey) => visibleActivityColumns.includes(column);

  const toggleActivityColumn = (column: ActivityColumnKey) => {
    setVisibleActivityColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const isScheduleColumnVisible = (column: ScheduleDialogColumnKey) => visibleScheduleColumns.includes(column);

  const toggleScheduleColumn = (column: ScheduleDialogColumnKey) => {
    setVisibleScheduleColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column]
    );
  };

  const handleToolbarViewChange = (nextView: EmployeeToolbarView) => {
    if (nextView === "analytics" || nextView === "table") {
      toast("This view is not available yet");
      return;
    }

    setToolbarView(nextView);
  };

  const isConnectionsView = toolbarView === "connections";
  const isActivityView = toolbarView === "activity";

  const scheduleFilteredEmployees = useMemo(() => {
    const query = scheduleSearchTerm.trim().toLowerCase();

    return filteredEmployeesWithSummary.filter((employee) => {
      if (!query) return true;

      return [
        employee.name,
        employee.email,
        employee.phone ?? "",
        employee.department ?? "",
        employee.position ?? "",
        roleLabels[employee.role],
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [filteredEmployeesWithSummary, scheduleSearchTerm]);

  const visibleScheduledActivities = useMemo(() => {
    const filteredEmployeeIds = new Set(filteredEmployeesWithSummary.map((employee) => employee.id));

    return scheduledActivities.filter(
      (activity) =>
        filteredEmployeeIds.has(activity.ownerId) && visibleActivityColumns.includes(activity.type)
    );
  }, [filteredEmployeesWithSummary, scheduledActivities, visibleActivityColumns]);

  const activityRows = useMemo(
    () =>
      filteredEmployeesWithSummary.filter((employee) =>
        visibleScheduledActivities.some((activity) => activity.ownerId === employee.id)
      ),
    [filteredEmployeesWithSummary, visibleScheduledActivities]
  );

  const activityItemsByCell = useMemo(() => {
    const items = new Map<string, ScheduledActivityItem[]>();

    for (const activity of visibleScheduledActivities) {
      const key = `${activity.ownerId}:${activity.type}`;
      const currentItems = items.get(key) ?? [];
      currentItems.push(activity);
      items.set(key, currentItems);
    }

    return items;
  }, [visibleScheduledActivities]);

  const activityCountsByColumn = useMemo(() => {
    const counts = activityColumnOptions.reduce(
      (result, column) => {
        result[column.key] = 0;
        return result;
      },
      {} as Record<ActivityColumnKey, number>
    );

    for (const activity of visibleScheduledActivities) {
      counts[activity.type] += 1;
    }

    return counts;
  }, [visibleScheduledActivities]);

  const meetingWeekStart = useMemo(
    () => startOfWeek(meetingViewDate, { weekStartsOn: 0 }),
    [meetingViewDate]
  );

  const meetingWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(meetingWeekStart, index)),
    [meetingWeekStart]
  );

  const miniMonthDays = useMemo(() => {
    const monthStart = startOfMonth(meetingViewDate);
    const monthEnd = endOfMonth(meetingViewDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days: Date[] = [];
    let cursor = gridStart;

    while (cursor <= gridEnd) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }

    return days;
  }, [meetingViewDate]);

  const openMeetingSlot = (day: Date, timeLabel: (typeof MEETING_TIME_SLOTS)[number]) => {
    const slotDate = new Date(day);
    const hour = parseTimeLabel(timeLabel);
    slotDate.setHours(hour, 0, 0, 0);
    setMeetingEditorState(null);
    setMeetingDate(slotDate);
    setMeetingViewDate(slotDate);
    setMeetingTime(format(slotDate, "HH:mm"));
    setMeetingEndTime(format(addHours(slotDate, 1), "HH:mm"));
    setScheduleActivityDueDate(format(slotDate, "yyyy-MM-dd"));
  };

  const draftMeetingActivity = useMemo<ScheduledActivityItem | null>(() => {
    if (selectedScheduleActivityType !== "meeting" || !selectedScheduleEmployee || !meetingDate) {
      return null;
    }

    const ownerId = scheduleActivityOwnerId ?? selectedScheduleEmployee.id;

    return {
      id: `${ownerId}-meeting`,
      ownerId,
      assigneeId: selectedScheduleEmployee.id,
      type: "meeting",
      summary: scheduleActivitySummary.trim() || "Meeting",
      dueDate: format(meetingDate, "yyyy-MM-dd"),
      meetingTime,
      meetingEndTime,
      note: scheduleActivityNote,
      flow: scheduleActivityFlow,
    };
  }, [
    meetingDate,
    meetingEndTime,
    meetingTime,
    scheduleActivityFlow,
    scheduleActivityNote,
    scheduleActivityOwnerId,
    scheduleActivitySummary,
    selectedScheduleActivityType,
    selectedScheduleEmployee,
  ]);

  const calendarMeetingActivities = useMemo(() => {
    const currentOwnerId = scheduleActivityOwnerId ?? selectedScheduleEmployee?.id ?? null;
    let items = scheduledActivities.filter((activity) => activity.type === "meeting");

    if (draftMeetingActivity) {
      items = [draftMeetingActivity, ...items.filter((activity) => activity.id !== draftMeetingActivity.id)];
    }

    if (currentOwnerId) {
      items = items.filter((activity) => activity.ownerId === currentOwnerId);
    }

    return items;
  }, [draftMeetingActivity, scheduleActivityOwnerId, scheduledActivities, selectedScheduleEmployee]);

  const meetingActivitiesBySlot = useMemo(() => {
    const items = new Map<string, ScheduledActivityItem[]>();

    for (const activity of calendarMeetingActivities) {
      const startHour = Number((activity.meetingTime ?? "10:00").split(":")[0] ?? 10);
      const key = `${activity.dueDate}:${startHour}`;
      const currentItems = items.get(key) ?? [];
      currentItems.push(activity);
      items.set(key, currentItems);
    }

    return items;
  }, [calendarMeetingActivities]);

  const scheduleTotal = scheduleFilteredEmployees.length;
  const meetingEditorAssignee = meetingEditorState ? employeeById.get(meetingEditorState.assigneeId) ?? null : null;

  const getScheduleContractType = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "Admin";
      case "TEAMLEADER":
        return "Team Leader";
      case "BA":
        return "Business Analyst";
      default:
        return "Employee";
    }
  };

  const renderConnectionNode = (employee: EmployeeWithSummary, variant: "admin" | "leader" | "member") => (
    <div
      className={cn(
        "relative w-full max-w-[145px] rounded-lg border bg-white px-2 pb-2 pt-2.5 text-center shadow-sm",
        variant === "admin"
          ? "border-violet-200 ring-1 ring-violet-100"
          : variant === "leader"
          ? "border-sky-200 ring-1 ring-sky-100"
          : "border-slate-200"
      )}
    >
      <span
        className={cn(
          "absolute right-2 top-2 h-2.5 w-2.5 rounded-full border",
          employee.isActive ? "border-slate-300 bg-slate-300" : "border-slate-400 bg-slate-400"
        )}
        aria-label={employee.isActive ? "Active" : "Inactive"}
        title={employee.isActive ? "Active" : "Inactive"}
      />
      <div
        className={cn(
          "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold text-white shadow-md",
          kanbanPanelColors[employee.role]
        )}
      >
        {employee.name.trim().charAt(0).toUpperCase()}
      </div>

      <Link
        href={`/employees/${employee.id}`}
        className="mt-1.5 block truncate text-sm font-semibold text-slate-900 hover:text-slate-700"
      >
        {employee.name}
      </Link>
      <p className="mt-0.5 truncate text-[11px] text-slate-600">
        {employee.position || employee.department || roleLabels[employee.role]}
      </p>
      <Badge
        className={cn(
          "mt-1 border-0 px-1.5 py-0 text-[10px] font-medium",
          variant === "admin"
            ? "bg-violet-100 text-violet-700 hover:bg-violet-100"
            : variant === "leader"
            ? "bg-sky-100 text-sky-700 hover:bg-sky-100"
            : "bg-slate-100 text-slate-700 hover:bg-slate-100"
        )}
      >
        {variant === "admin" ? "Admin" : variant === "leader" ? "Team Leader" : roleLabels[employee.role]}
      </Badge>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="sticky top-0 z-20 shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
              <Button asChild className="md:min-w-[150px]">
                <Link href="/employees/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Employee
                </Link>
              </Button>
              <div className="w-full min-w-0 md:max-w-2xl">
                <div className="flex w-full overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-slate-400">
                  <div className="relative flex-1">
                    <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search employee name"
                      className="h-11 rounded-none border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
                    />
                  </div>

                  <div className="w-px bg-slate-200" />

                  <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
                    <SelectTrigger className="h-11 w-[170px] rounded-none border-0 bg-slate-50 px-4 shadow-none focus:ring-0 focus:ring-offset-0">
                      <SelectValue placeholder="Filter role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All ({roleCounts.ALL})</SelectItem>
                      <SelectItem value="EMPLOYEE">Employee ({roleCounts.EMPLOYEE})</SelectItem>
                      <SelectItem value="TEAMLEADER">TL ({roleCounts.TEAMLEADER})</SelectItem>
                      <SelectItem value="BA">BA ({roleCounts.BA})</SelectItem>
                      <SelectItem value="ADMIN">Admin ({roleCounts.ADMIN})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="inline-flex self-start overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm xl:self-auto">
              {employeeToolbarOptions.map((option) => {
                const Icon = option.icon;
                const isActive = toolbarView === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleToolbarViewChange(option.id)}
                    className={cn(
                      "flex h-10 w-12 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors first:border-l-0",
                      isActive ? "bg-sky-600 text-white ring-1 ring-inset ring-sky-300" : "bg-white hover:bg-slate-50 hover:text-slate-700"
                    )}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border p-3 shadow-sm",
          isActivityView
            ? "border-slate-200 bg-white p-0"
            : isConnectionsView
              ? "border-slate-200 bg-white p-6"
              : "border-slate-200 bg-white"
        )}
      >
        {filteredEmployees.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">No employees found</p>
        ) : isKanbanView ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployeesWithSummary.map((employee) => (
              <div
                key={employee.id}
                className="w-full min-w-0 overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[0_18px_40px_-30px_rgba(15,23,42,0.2)]"
              >
                <div className="flex min-h-[144px]">
                  <div
                    className={cn(
                      "flex w-[128px] shrink-0 items-center justify-center px-4",
                      kanbanPanelColors[employee.role]
                    )}
                  >
                    <span className="text-4xl font-semibold uppercase tracking-tight text-white sm:text-5xl">
                      {employee.name.trim().charAt(0) || "E"}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col px-4 py-2.5 text-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={`/employees/${employee.id}`}
                          className="block truncate text-[17px] font-semibold tracking-tight text-slate-900 hover:text-slate-700"
                        >
                          {employee.name}
                        </Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-3.5 w-3.5 rounded-full border border-slate-200",
                            employee.isActive ? "bg-slate-300" : "bg-slate-500"
                          )}
                          aria-label={employee.isActive ? "Active" : "Inactive"}
                          title={employee.isActive ? "Active" : "Inactive"}
                        />
                        {renderEmployeeActions(employee)}
                      </div>
                    </div>

                    <div className="mt-1.5 space-y-1 text-[14px] text-slate-700">
                      {employee.position ? (
                        <div className="flex min-w-0 items-center gap-2.5">
                          <BriefcaseBusiness className="h-4 w-4 shrink-0 text-fuchsia-500" />
                          <span className="truncate">{employee.position}</span>
                        </div>
                      ) : null}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Mail className="h-4 w-4 shrink-0 text-fuchsia-500" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge className="border-0 bg-fuchsia-100 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700 hover:bg-fuchsia-100">
                        {employee.position || employee.department || roleLabels[employee.role]}
                      </Badge>
                      <Badge className="border-0 bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700 hover:bg-sky-100">
                        {employee.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        {employee.moduleBadges.slice(0, 1).map((module) => (
                          <Badge
                            key={`${employee.id}-kanban-${module}`}
                            className="border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            {module}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="inline-flex min-w-[30px] items-center justify-center rounded-md bg-fuchsia-600 px-2 py-0.5 text-xs font-semibold text-white">
                          {employee._count.assignments}
                        </div>
                        <div className="inline-flex min-w-[30px] items-center justify-center rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {employee._count.timeEntries}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : isActivityView ? (
          <div className="min-h-[560px] overflow-hidden rounded-xl bg-white">
            <Table className="w-full table-fixed text-[15px] text-slate-700">
              <TableHeader className="bg-slate-50 [&_tr]:border-slate-200">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-[18%] border-r border-slate-200 px-4 py-6 text-slate-900" />
                  {activityColumnOptions.map((column) =>
                    isActivityColumnVisible(column.key) ? (
                      <TableHead
                        key={column.key}
                        className={cn(
                          "border-r border-slate-200 px-4 py-6 text-[15px] font-semibold text-slate-900",
                          column.key === "requestSignature" ? "w-[16%]" : "w-[11%]"
                        )}
                      >
                        <div className="space-y-3">
                          <span>{column.label}</span>
                          {activityCountsByColumn[column.key] > 0 ? (
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className={cn("h-full rounded-full", activityColumnStyles[column.key].bar)}
                                  style={{ width: "100%" }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-slate-700">
                                {activityCountsByColumn[column.key]} / {activityCountsByColumn[column.key]}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TableHead>
                    ) : null
                  )}
                  <TableHead className="w-[40px] px-2 py-6 text-right text-slate-900">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Choose activity columns"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        side="bottom"
                        className="w-[220px] border-slate-200 bg-white p-0 text-slate-900 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.28)]"
                      >
                        <div className="py-3">
                          {activityColumnOptions.map((column) => (
                            <label
                              key={column.key}
                              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[15px] text-slate-900 transition hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={isActivityColumnVisible(column.key)}
                                onChange={() => toggleActivityColumn(column.key)}
                                className="h-4 w-4 rounded border-slate-300 bg-white accent-cyan-500"
                              />
                              <span>{column.label}</span>
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {activityRows.map((employee) => (
                  <TableRow key={`${employee.id}-activity-row`} className="border-slate-200 bg-white hover:bg-white">
                    <TableCell className="border-r border-slate-200 px-3 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-semibold text-white",
                            kanbanPanelColors[employee.role]
                          )}
                        >
                          {employee.name.trim().charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-[15px] font-medium text-slate-900">{employee.name}</span>
                      </div>
                    </TableCell>
                    {activityColumnOptions.map((column) => {
                      if (!isActivityColumnVisible(column.key)) {
                        return null;
                      }

                      const cellActivities = activityItemsByCell.get(`${employee.id}:${column.key}`) ?? [];
                      const style = activityColumnStyles[column.key];

                      return (
                        <TableCell
                          key={`${employee.id}-${column.key}`}
                          className="border-r border-slate-200 px-0 py-0 align-top"
                        >
                          <div className="group relative min-h-[74px] bg-white">
                            {cellActivities.length > 0 ? (
                              <div className="space-y-px bg-slate-200/70">
                                {cellActivities.map((activity) => {
                                  const assignee = employeesWithSummary.find(
                                    (candidate) => candidate.id === activity.assigneeId
                                  );
                                  const assigneeInitial = assignee?.name.trim().charAt(0).toUpperCase() ?? "E";

                                  return (
                                    <div
                                      key={activity.id}
                                      className={cn(
                                        "w-full px-3 py-2.5 transition hover:brightness-95",
                                        style.card,
                                        style.text
                                      )}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        <Popover
                                          open={activeActivityPreviewId === activity.id}
                                          onOpenChange={(open) =>
                                            setActiveActivityPreviewId(open ? activity.id : null)
                                          }
                                        >
                                          <PopoverTrigger asChild>
                                            <button type="button" className="min-w-0 flex-1 text-left">
                                              <div className="min-w-0">
                                                <p className="truncate text-[14px] font-semibold leading-tight">
                                                  {activity.summary}
                                                </p>
                                                <p
                                                  className={cn(
                                                    "mt-1.5 truncate text-[12px] font-medium leading-tight",
                                                    style.text === "text-white" ? "text-white/90" : "text-slate-800"
                                                  )}
                                                >
                                                  {formatActivityDate(activity.dueDate, true)}
                                                </p>
                                              </div>
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            align="start"
                                            side="bottom"
                                            sideOffset={10}
                                            className="w-[380px] overflow-hidden border-slate-200 bg-white p-0 text-slate-700 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.22)]"
                                          >
                                            <div className="h-2.5 bg-emerald-500" />
                                            <div className="border-b border-slate-200 px-4 py-2.5">
                                              <div className="flex items-center justify-between gap-3">
                                                <span className="text-[15px] font-semibold text-emerald-600">Planned</span>
                                                <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-semibold text-white">
                                                  1
                                                </span>
                                              </div>
                                            </div>
                                            <div className="space-y-4 px-4 py-3">
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className="truncate text-[15px] font-semibold text-slate-900">
                                                    {activity.summary}
                                                  </p>
                                                  <div className="mt-2.5 flex items-center gap-2.5">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-700 text-xs font-semibold text-white">
                                                      {assigneeInitial}
                                                    </div>
                                                    <p className="truncate text-[14px] text-slate-600">
                                                      {assignee?.name ?? "Employee"} - {getActivityPreviewDateLabel(activity.dueDate)}
                                                    </p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 text-slate-400">
                                                  <button
                                                    type="button"
                                                    className="transition hover:text-emerald-400"
                                                    onClick={async () => {
                                                      const result = await markEmployeeScheduledActivityDone(
                                                        activity.ownerId,
                                                        activity.type
                                                      );

                                                      if (!result.success) {
                                                        toast.error(result.error ?? "Unable to mark activity done");
                                                        return;
                                                      }

                                                      removeScheduledActivityLocally(activity.ownerId, activity.type);
                                                      setActiveActivityPreviewId(null);
                                                      toast.success("Activity marked done");
                                                    }}
                                                    aria-label="Mark activity done"
                                                  >
                                                    <Check className="h-4 w-4" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="transition hover:text-slate-700"
                                                    onClick={() => toast("Calendar details are shown in the activity dialog")}
                                                    aria-label="View activity calendar"
                                                  >
                                                    <CalendarDays className="h-4 w-4" />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="transition hover:text-rose-400"
                                                    onClick={async () => {
                                                      const result = await cancelEmployeeScheduledActivity(
                                                        activity.ownerId,
                                                        activity.type
                                                      );

                                                      if (!result.success) {
                                                        toast.error(result.error ?? "Unable to cancel activity");
                                                        return;
                                                      }

                                                      removeScheduledActivityLocally(activity.ownerId, activity.type);
                                                      setActiveActivityPreviewId(null);
                                                      toast.success(
                                                        activity.type === "meeting" ? "Meeting cancelled" : "Activity cancelled"
                                                      );
                                                    }}
                                                    aria-label="Cancel activity"
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => openScheduledActivityDialog(activity)}
                                                className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-900 transition hover:text-sky-600"
                                              >
                                                <Plus className="h-4 w-4" />
                                                Schedule an activity
                                              </button>
                                            </div>
                                          </PopoverContent>
                                        </Popover>

                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button
                                              type="button"
                                              className="mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-700 text-xs font-semibold text-white"
                                              aria-label={`View ${assignee?.name ?? "employee"} details`}
                                            >
                                              {assigneeInitial}
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent
                                            align="end"
                                            side="bottom"
                                            sideOffset={10}
                                            className="w-[350px] overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.24)]"
                                          >
                                            <div className="flex items-start gap-3 p-3.5">
                                              <div className="relative shrink-0">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-violet-800 text-[30px] font-semibold text-white">
                                                  {assigneeInitial}
                                                </div>
                                                {assignee?.isActive ? (
                                                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
                                                ) : null}
                                              </div>
                                              <div className="min-w-0 flex-1 pt-0.5">
                                                <p className="truncate text-[14px] font-semibold leading-tight text-slate-900">
                                                  {assignee?.name ?? "Employee"}
                                                </p>
                                                <div className="mt-1.5 flex items-center gap-2 text-[13px] text-cyan-300">
                                                  <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                                                  <span className="truncate leading-tight text-cyan-600">
                                                    {assignee?.email ?? "No email address"}
                                                  </span>
                                                </div>
                                                <div className="mt-3 flex items-center gap-2.5">
                                                  <Button
                                                    asChild
                                                    type="button"
                                                    className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
                                                  >
                                                    <a href={`mailto:${assignee?.email ?? ""}`}>Send message</a>
                                                  </Button>
                                                  <Button
                                                    asChild
                                                    type="button"
                                                    className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
                                                  >
                                                    <Link href={`/employees/${assignee?.id ?? activity.assigneeId}`}>View Profile</Link>
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEmptyActivityCellSelect(employee, column.key)}
                                className="absolute inset-0 flex items-center justify-center opacity-0 transition duration-150 group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label={`Schedule ${getActivityLabel(column.key)} for ${employee.name}`}
                              >
                                <span className="absolute inset-0 bg-slate-300/90" />
                                <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600">
                                  <Plus className="h-5 w-5" />
                                </span>
                              </button>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="bg-white px-2 py-4" />
                  </TableRow>
                ))}
                <TableRow className="border-slate-200 bg-white hover:bg-white">
                  <TableCell
                    colSpan={visibleActivityColumns.length + 2}
                    className="px-8 py-8 text-slate-700"
                  >
                    <button
                      type="button"
                      onClick={openScheduleDialog}
                      className="inline-flex items-center gap-3 text-[15px] font-semibold text-cyan-600 transition hover:text-cyan-500"
                    >
                      <Plus className="h-5 w-5" />
                      Schedule activity
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ) : isConnectionsView ? (
          <div className="pb-6 pt-3">
            {connectionAdmins.length > 0 ? (
              <div className="mb-2 flex flex-col items-center">
                <div className="flex flex-wrap justify-center gap-3">
                  {connectionAdmins.map((admin) => (
                    <div key={admin.id} className="flex w-full justify-center sm:w-auto">
                      {renderConnectionNode(admin, "admin")}
                    </div>
                  ))}
                </div>
                {teamConnectionGroups.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-px bg-slate-300" />
                    <div className="hidden h-px w-[min(920px,84vw)] bg-slate-300 lg:block" />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative grid grid-cols-1 justify-items-center gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {teamConnectionGroups.map((group) => (
                <div key={group.id} className="relative flex w-full justify-center pt-4">
                  {connectionAdmins.length > 0 ? (
                    <div className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-slate-300" />
                  ) : null}
                  <section className="flex w-full max-w-[400px] flex-col rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{group.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {group.leaders.length} leader{group.leaders.length === 1 ? "" : "s"} -{" "}
                          {group.members.length} member{group.members.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        Team hierarchy
                      </Badge>
                </div>

                    <div className="flex flex-col items-center">
                      {group.leaders.length > 0 ? (
                        <div className="flex w-full flex-col items-center gap-2">
                          {group.leaders.map((leader) => (
                            <div key={leader.id} className="flex w-full justify-center">
                              {renderConnectionNode(leader, "leader")}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-500">
                          Team leader not assigned
                        </div>
                      )}

                      {group.members.length > 0 ? (
                        <>
                          <div className="h-4 w-px bg-slate-300" />
                          <div className="relative w-full pt-4">
                            {group.members.length > 1 ? (
                              <div className="absolute left-[25%] right-[25%] top-0 h-px bg-slate-300" />
                            ) : null}
                            <div className="relative z-10 grid grid-cols-1 justify-items-center gap-x-3 gap-y-4 sm:grid-cols-2">
                              {group.members.map((member) => (
                                <div key={member.id} className="relative flex w-full justify-center">
                                  <div className="absolute left-1/2 top-[-1rem] h-4 w-px -translate-x-1/2 bg-slate-300" />
                                  {renderConnectionNode(member, "member")}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
                          No employees shown under this team.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              ))}
            </div>

            {unassignedConnectionGroup ? (
              <section className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Unassigned</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {unassignedConnectionGroup.leaders.length + unassignedConnectionGroup.members.length} user
                      {unassignedConnectionGroup.leaders.length + unassignedConnectionGroup.members.length === 1 ? "" : "s"} not in any team
                    </p>
                  </div>
                  <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                    Not in team
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 justify-items-center gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                  {[...unassignedConnectionGroup.leaders, ...unassignedConnectionGroup.members].map((employee) => (
                    <div key={employee.id} className="flex w-full justify-center">
                      {renderConnectionNode(employee, employee.role === "TEAMLEADER" ? "leader" : "member")}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Table className="min-w-[980px] text-sm text-slate-700">
              <TableHeader className="bg-slate-50 [&_tr]:border-slate-200">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-[56px] px-4 py-4 text-slate-900">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select all employees"
                      className="h-4 w-4 rounded border-slate-300 bg-white text-sky-500 focus:ring-sky-400"
                    />
                  </TableHead>
                  <TableHead className="min-w-[220px] px-4 py-4 text-[15px] font-semibold text-slate-900">Name</TableHead>
                  {isListColumnVisible("workPhone") ? (
                    <TableHead className="min-w-[180px] px-4 py-4 text-[15px] font-semibold text-slate-900">Work Phone</TableHead>
                  ) : null}
                  {isListColumnVisible("workEmail") ? (
                    <TableHead className="min-w-[280px] px-4 py-4 text-[15px] font-semibold text-slate-900">Work Email</TableHead>
                  ) : null}
                  {isListColumnVisible("workLocation") ? (
                    <TableHead className="min-w-[190px] px-4 py-4 text-[15px] font-semibold text-slate-900">Work Location</TableHead>
                  ) : null}
                  {isListColumnVisible("employeeType") ? (
                    <TableHead className="min-w-[160px] px-4 py-4 text-[15px] font-semibold text-slate-900">Employee Type</TableHead>
                  ) : null}
                  {isListColumnVisible("job") ? (
                    <TableHead className="min-w-[190px] px-4 py-4 text-[15px] font-semibold text-slate-900">Job</TableHead>
                  ) : null}
                  {isListColumnVisible("status") ? (
                    <TableHead className="min-w-[140px] px-4 py-4 text-[15px] font-semibold text-slate-900">Status</TableHead>
                  ) : null}
                  {isListColumnVisible("projects") ? (
                    <TableHead className="min-w-[120px] px-4 py-4 text-[15px] font-semibold text-slate-900">Projects</TableHead>
                  ) : null}
                  {isListColumnVisible("timeEntries") ? (
                    <TableHead className="min-w-[130px] px-4 py-4 text-[15px] font-semibold text-slate-900">Time Entries</TableHead>
                  ) : null}
                  {isListColumnVisible("moduleAccess") ? (
                    <TableHead className="min-w-[220px] px-4 py-4 text-[15px] font-semibold text-slate-900">Module Access</TableHead>
                  ) : null}
                  <TableHead className="sticky right-0 z-20 w-[64px] bg-slate-50 px-4 py-4 text-right text-slate-900 shadow-[-10px_0_14px_-14px_rgba(15,23,42,0.28)]">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label="Choose visible columns"
                        >
                          <Settings2 className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        side="bottom"
                        className="w-[220px] border-slate-200 bg-white p-0 text-slate-700 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.28)]"
                      >
                        <div className="max-h-[520px] overflow-y-auto py-3">
                          {listColumnOptions.map((column) => (
                            <label
                              key={column.key}
                              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[15px] text-slate-700 transition hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={isListColumnVisible(column.key)}
                                onChange={() => toggleListColumn(column.key)}
                                className="h-4 w-4 rounded border-slate-300 bg-white accent-cyan-500"
                              />
                              <span>{column.label}</span>
                            </label>
                          ))}
                        </div>
                        <div className="border-t border-slate-200 p-3">
                          <button
                            type="button"
                            onClick={() => toast("Custom fields are not available yet")}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[15px] font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Plus className="h-4 w-4" />
                            Add Custom Field
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="[&_tr:last-child]:border-b-0">
                {filteredEmployeesWithSummary.map((employee) => {
                  const isSelected = selectedEmployeeIds.includes(employee.id);

                  return (
                    <TableRow
                      key={employee.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 data-[state=selected]:bg-sky-50"
                    >
                      <TableCell className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectEmployee(employee.id)}
                          aria-label={`Select ${employee.name}`}
                          className="h-4 w-4 rounded border-slate-300 bg-white text-sky-500 focus:ring-sky-400"
                        />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                              kanbanPanelColors[employee.role]
                            )}
                          >
                            {employee.name.trim().charAt(0).toUpperCase()}
                          </div>
                          <Link
                            href={`/employees/${employee.id}`}
                            className="truncate font-medium text-slate-900 hover:text-slate-700"
                          >
                            {employee.name}
                          </Link>
                        </div>
                      </TableCell>
                      {isListColumnVisible("workPhone") ? (
                        <TableCell className="px-4 py-4 text-slate-700">
                          {employee.phone?.trim() ? employee.phone : "-"}
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("workEmail") ? (
                        <TableCell className="px-4 py-4 text-slate-700">
                          <span className="block truncate">{employee.email}</span>
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("workLocation") ? (
                        <TableCell className="px-4 py-4 text-slate-600">
                          {employee.department || "-"}
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("employeeType") ? (
                        <TableCell className="px-4 py-4">
                          <Badge className={`${roleColors[employee.role]} border-0 px-2.5 py-0.5 text-xs font-medium text-white`}>
                            {roleLabels[employee.role]}
                          </Badge>
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("job") ? (
                        <TableCell className="px-4 py-4 text-slate-700">
                          {employee.position || "-"}
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("status") ? (
                        <TableCell className="px-4 py-4">
                          <Badge
                            variant={employee.isActive ? "default" : "secondary"}
                            className="px-2.5 py-0.5 text-xs"
                          >
                            {employee.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("projects") ? (
                        <TableCell className="px-4 py-4 text-slate-700">
                          {employee._count.assignments}
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("timeEntries") ? (
                        <TableCell className="px-4 py-4 text-slate-700">
                          {employee._count.timeEntries}
                        </TableCell>
                      ) : null}
                      {isListColumnVisible("moduleAccess") ? (
                        <TableCell className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {employee.moduleBadges.length === 0 ? (
                              <span className="text-slate-500">No modules</span>
                            ) : (
                              employee.moduleBadges.map((module) => (
                                <Badge
                                  key={`${employee.id}-list-${module}`}
                                  variant="outline"
                                  className="border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                                >
                                  {module}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell
                        className={cn(
                          "sticky right-0 z-10 px-4 py-4 text-right shadow-[-10px_0_14px_-14px_rgba(15,23,42,0.2)]",
                          isSelected ? "bg-sky-50" : "bg-white"
                        )}
                      >
                        <div className="flex justify-end">
                          {renderEmployeeActions(employee)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the employee and all related data.</span>
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

      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent
          className="flex max-h-[92vh] max-w-[min(1280px,96vw)] flex-col overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] sm:max-w-6xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-slate-200 px-5 py-5 text-left">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl font-semibold tracking-tight text-slate-900">Search: Employees</DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close schedule dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full max-w-[520px] min-w-0 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={scheduleSearchTerm}
                    onChange={(event) => setScheduleSearchTerm(event.target.value)}
                    placeholder="Search..."
                    className="h-11 border-0 bg-transparent pl-11 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                  />
                </div>
                <div className="flex h-11 w-11 items-center justify-center border-l border-slate-200 text-slate-500">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-700">
                <span>{scheduleTotal} employee{scheduleTotal === 1 ? "" : "s"}</span>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-0 pb-0">
            <Table className="min-w-[1220px] text-[15px] text-slate-700">
                <TableHeader className="bg-slate-50 [&_tr]:border-slate-200">
                  <TableRow className="hover:bg-slate-50">
                    {scheduleDialogColumnOptions.map((column) =>
                      isScheduleColumnVisible(column.key) ? (
                        <TableHead
                          key={column.key}
                          className="px-5 py-4 text-[15px] font-semibold text-slate-900"
                        >
                          {column.label}
                        </TableHead>
                      ) : null
                    )}
                    <TableHead className="sticky right-0 z-20 w-[52px] bg-slate-50 px-3 py-4 text-right text-slate-900 shadow-[-10px_0_14px_-14px_rgba(15,23,42,0.2)]">
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            aria-label="Choose employee columns"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          side="bottom"
                          className="w-[220px] border-slate-200 bg-white p-0 text-slate-900 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.35)]"
                        >
                          <div className="max-h-[340px] overflow-y-auto py-3">
                            {scheduleDialogColumnOptions.map((column) => (
                              <label
                                key={column.key}
                                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[15px] text-slate-700 transition hover:bg-slate-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={isScheduleColumnVisible(column.key)}
                                  onChange={() => toggleScheduleColumn(column.key)}
                                  className="h-4 w-4 rounded border-slate-300 accent-cyan-500"
                                />
                                <span>{column.label}</span>
                              </label>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody className="[&_tr:last-child]:border-b-slate-200">
                  {scheduleFilteredEmployees.length === 0 ? (
                    <TableRow className="border-slate-200 bg-white hover:bg-white">
                      <TableCell
                        colSpan={visibleScheduleColumns.length + 1}
                        className="px-5 py-10 text-center text-slate-500"
                      >
                        No employees match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    scheduleFilteredEmployees.map((employee) => (
                      <TableRow
                        key={`schedule-${employee.id}`}
                        className="group cursor-pointer border-slate-200 bg-white text-slate-900 hover:bg-sky-50/70"
                        onClick={() => handleScheduleEmployeeSelect(employee)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleScheduleEmployeeSelect(employee);
                          }
                        }}
                        tabIndex={0}
                      >
                        {isScheduleColumnVisible("name") ? (
                          <TableCell className="px-5 py-4">
                            <div className="flex min-w-0 items-center gap-4">
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                                  kanbanPanelColors[employee.role]
                                )}
                              >
                                {employee.name.trim().charAt(0).toUpperCase()}
                              </div>
                              <span className="truncate">{employee.name}</span>
                            </div>
                          </TableCell>
                        ) : null}
                        {isScheduleColumnVisible("workLocation") ? (
                          <TableCell className="px-5 py-4 text-slate-700">{employee.department || "-"}</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("contractStartDate") ? (
                          <TableCell className="px-5 py-4 text-slate-700">
                            {employee.hireDate ? format(new Date(employee.hireDate), "dd/MM/yyyy") : "-"}
                          </TableCell>
                        ) : null}
                        {isScheduleColumnVisible("contractEndDate") ? (
                          <TableCell className="px-5 py-4 text-slate-700">-</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("wage") ? (
                          <TableCell className="px-5 py-4 text-slate-700">₹ 0.00</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("contractType") ? (
                          <TableCell className="px-5 py-4 text-slate-700">{getScheduleContractType(employee.role)}</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("department") ? (
                          <TableCell className="px-5 py-4 text-slate-700">{employee.department || "-"}</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("job") ? (
                          <TableCell className="px-5 py-4 text-slate-700">{employee.position || "-"}</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("manager") ? (
                          <TableCell className="px-5 py-4 text-slate-700">-</TableCell>
                        ) : null}
                        {isScheduleColumnVisible("birthday") ? (
                          <TableCell className="px-5 py-4 text-slate-700">-</TableCell>
                        ) : null}
                        <TableCell className="sticky right-0 z-10 bg-white px-3 py-4 shadow-[-10px_0_14px_-14px_rgba(15,23,42,0.2)] group-hover:bg-sky-50/70" />
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>

          <DialogFooter className="shrink-0 border-t border-slate-200 bg-white px-5 py-5 sm:justify-start">
            <Button asChild className="bg-sky-600 text-white hover:bg-sky-700">
              <Link href="/employees/new">Create New</Link>
            </Button>
            <DialogClose asChild>
              <Button variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleActivityDialogOpen} onOpenChange={handleScheduleActivityDialogChange}>
        <DialogContent
          className={cn(
            "flex max-h-[92vh] flex-col overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)]",
            showMeetingCalendar ? "max-w-[min(1480px,96vw)] sm:max-w-[1480px]" : "max-w-[min(1280px,92vw)] sm:max-w-5xl"
          )}
          showCloseButton={false}
        >
          <DialogHeader className={cn("border-b border-slate-200 px-5 py-5 text-left", showMeetingCalendar && "hidden")}>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-[18px] font-semibold tracking-tight text-slate-900">Schedule Activity</DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Close schedule activity dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </DialogClose>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-hidden">
            <div className={cn("space-y-5 px-5 py-5", showMeetingCalendar && "space-y-0 px-0 py-0")}>
              {!showMeetingCalendar ? (
                <div className="flex flex-wrap gap-2">
                  {(["offboarding", "onboarding"] as const).map((flow) => (
                    <button
                      key={flow}
                      type="button"
                      onClick={() => setScheduleActivityFlow(flow)}
                      className={cn(
                        "rounded-md px-4 py-2 text-[15px] font-semibold capitalize transition",
                        scheduleActivityFlow === flow
                          ? "bg-sky-600 text-white"
                          : "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {flow}
                    </button>
                  ))}
                </div>
              ) : null}

              {!showMeetingCalendar ? (
                <div className="flex flex-wrap gap-2">
                  {scheduleActivityTypeOptions.map((activity) => {
                    const isSelected = selectedScheduleActivityType === activity.key;

                    return (
                      <button
                        key={activity.key}
                        type="button"
                        onClick={() => handleScheduleActivityTypeChange(activity.key)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[15px] font-semibold transition",
                          isSelected
                            ? "border-sky-500 bg-sky-50 text-sky-700"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Check className="h-4 w-4" />
                        {activity.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedScheduleActivityType === "meeting" ? (
                showMeetingCalendar ? (
                  <div className="relative h-full overflow-auto bg-white">
                    <DialogClose asChild>
                      <button
                        type="button"
                        className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Close schedule activity dialog"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </DialogClose>
                    <div className="grid min-h-[620px] min-w-[1120px] bg-white xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div className="border-r border-slate-200">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => setMeetingViewDate(addDays(meetingViewDate, -7))}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="h-8 w-8 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                onClick={() => setMeetingViewDate(addDays(meetingViewDate, 7))}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-8 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Week
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-8 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => setMeetingViewDate(new Date())}
                            >
                              Today
                            </Button>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-semibold text-slate-900">
                                {format(meetingWeekStart, "MMMM")} - {format(addDays(meetingWeekStart, 6), "MMMM yyyy")}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-sm font-semibold text-slate-700">
                                Week {format(meetingWeekStart, "I")}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                              <span>Synchronize with</span>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 border-sky-400 bg-white px-3 text-sm text-slate-900 hover:bg-sky-50"
                                onClick={() => toast("Google calendar sync is not available yet")}
                              >
                                <span className="rounded-sm bg-white px-1 py-0.5 text-xs font-bold text-slate-900">G</span>
                                Google
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="h-9 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => toast("Sharing is not available yet")}
                            >
                              Share
                            </Button>
                          </div>
                        </div>

                        <div
                          className="grid"
                          style={{ gridTemplateColumns: `80px repeat(${meetingWeekDays.length}, minmax(0, 1fr))` }}
                        >
                          <div className="border-b border-r border-slate-200 bg-slate-50" />
                          {meetingWeekDays.map((day) => (
                            <div
                              key={day.toISOString()}
                              className="border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-center last:border-r-0"
                            >
                              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                                {format(day, "EEE")}
                              </p>
                              <div className="mt-2 flex justify-center">
                                <span
                                  className={cn(
                                    "flex h-12 w-12 items-center justify-center rounded-full text-2xl font-semibold",
                                    isSameDay(day, meetingViewDate) ? "bg-red-600 text-white" : "text-slate-900"
                                  )}
                                >
                                  {format(day, "d")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="max-h-[470px] overflow-y-auto">
                          <div
                          className="grid"
                          style={{ gridTemplateColumns: `80px repeat(${meetingWeekDays.length}, minmax(0, 1fr))` }}
                        >
                          {MEETING_TIME_SLOTS.map((timeLabel) => (
                            <Fragment key={timeLabel}>
                                <div className="border-r border-t border-slate-200 bg-white px-3 py-5 text-right text-base text-slate-600">
                                  {timeLabel}
                                </div>
                                {meetingWeekDays.map((day) => {
                                  const slotKey = `${format(day, "yyyy-MM-dd")}:${parseTimeLabel(timeLabel)}`;
                                  const slotActivities = meetingActivitiesBySlot.get(slotKey) ?? [];

                                  return (
                                    <div
                                      key={`${day.toISOString()}-${timeLabel}`}
                                      className="relative min-h-[74px] border-r border-t border-slate-200 bg-white last:border-r-0"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openMeetingSlot(day, timeLabel)}
                                        className="absolute inset-0 transition hover:bg-slate-50"
                                        aria-label={`Select ${format(day, "MMMM d")} at ${timeLabel}`}
                                      />
                                      {slotActivities.length > 0 ? (
                                        <div className="relative z-10 flex h-full flex-col gap-1 p-1">
                                          {slotActivities.map((activity) => {
                                            const assignee = employeeById.get(activity.assigneeId);

                                            return (
                                              <button
                                                key={activity.id}
                                                type="button"
                                                onClick={() => openMeetingEventEditor(activity)}
                                                className={cn(
                                                  "flex min-h-[64px] items-start justify-between gap-3 rounded-md px-3 py-2 text-left shadow transition hover:brightness-95",
                                                  activityColumnStyles.meeting.card,
                                                  activityColumnStyles.meeting.text,
                                                  meetingEditorState?.id === activity.id && "ring-2 ring-sky-400 ring-offset-1 ring-offset-white"
                                                )}
                                              >
                                                <div className="min-w-0">
                                                  <p className="truncate text-sm font-semibold">
                                                    {activity.summary.trim() || "Meeting"}
                                                  </p>
                                                  <p className="mt-2 text-xs font-medium">
                                                    {formatActivityDate(activity.dueDate)}
                                                  </p>
                                                </div>
                                                <div
                                                  className={cn(
                                                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                                                    assignee ? kanbanPanelColors[assignee.role] : "bg-violet-700"
                                                  )}
                                                >
                                                  {assignee?.name.trim().charAt(0).toUpperCase() ?? "E"}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col bg-white">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                          <div className="flex items-center gap-3 text-slate-500">
                            <button
                              type="button"
                              className="transition hover:text-slate-900"
                              onClick={() => setMeetingViewDate(addDays(meetingViewDate, -30))}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="transition hover:text-slate-900"
                              onClick={() => setMeetingViewDate(addDays(meetingViewDate, 30))}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="text-xl font-semibold text-slate-700">{format(meetingViewDate, "MMM yyyy")}</p>
                          <CalendarDays className="h-4 w-4 text-slate-500" />
                        </div>

                        <div className="px-4 py-3">
                          <div className="mb-3 grid grid-cols-7 text-center text-sm font-semibold text-slate-600">
                            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                              <span key={`${label}-${index}`}>{label}</span>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
                            {miniMonthDays.map((day) => {
                              const isInMonth = isSameMonth(day, meetingViewDate);
                              const isSelectedDay = isSameDay(day, meetingViewDate);

                              return (
                                <button
                                  key={day.toISOString()}
                                  type="button"
                                  onClick={() => {
                                    const nextDate = new Date(day);
                                    const [hour, minute] = meetingTime.split(":").map(Number);
                                    nextDate.setHours(hour || 10, minute || 0, 0, 0);
                                    setMeetingViewDate(day);
                                    setMeetingDate(nextDate);
                                    setScheduleActivityDueDate(format(nextDate, "yyyy-MM-dd"));
                                  }}
                                  className={cn(
                                    "mx-auto flex h-9 w-9 items-center justify-center rounded-full transition",
                                    isSelectedDay
                                      ? "bg-red-600 text-white ring-4 ring-sky-200"
                                      : isInMonth
                                        ? "text-slate-900 hover:bg-slate-100"
                                        : "text-slate-300 hover:bg-slate-100"
                                  )}
                                >
                                  {format(day, "d")}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-auto border-t border-slate-200 px-4 py-4">
                          <div className="flex items-center justify-between text-xl font-semibold text-slate-900">
                            <span>Attendees</span>
                            <ChevronDown className="h-4 w-4 text-slate-500" />
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <input type="checkbox" checked readOnly className="h-4 w-4 accent-cyan-500" />
                            <span
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold text-white",
                                selectedScheduleEmployee ? kanbanPanelColors[selectedScheduleEmployee.role] : "bg-slate-500"
                              )}
                            >
                              {selectedScheduleEmployee?.name.trim().charAt(0).toUpperCase() ?? "E"}
                            </span>
                            <span className="text-lg text-slate-900">
                              {selectedScheduleEmployee?.name ?? "Employee"}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="mt-4 text-base text-slate-500 transition hover:text-slate-700"
                            onClick={() => toast("Additional attendees are not available yet")}
                          >
                            + Add Attendees
                          </button>
                          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                            <div>
                              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Time
                              </label>
                              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                <Input
                                  type="time"
                                  value={meetingTime}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setMeetingTime(value);
                                    if (meetingDate) {
                                      const nextDate = new Date(meetingDate);
                                      const [hour, minute] = value.split(":").map(Number);
                                      nextDate.setHours(hour || 0, minute || 0, 0, 0);
                                      setMeetingDate(nextDate);
                                      setMeetingViewDate(nextDate);
                                      setScheduleActivityDueDate(format(nextDate, "yyyy-MM-dd"));
                                    }
                                  }}
                                  className="h-10 border-slate-200 bg-white text-sm text-slate-900"
                                />
                                <span className="text-slate-500">to</span>
                                <Input
                                  type="time"
                                  value={meetingEndTime}
                                  onChange={(event) => setMeetingEndTime(event.target.value)}
                                  className="h-10 border-slate-200 bg-white text-sm text-slate-900"
                                />
                              </div>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <span>{getMeetingDateTimeLabel().date}</span>
                              <span className="mx-2 text-slate-400">|</span>
                              <span>{getMeetingDateTimeLabel().start}</span>
                              <span className="mx-2 text-slate-400">-</span>
                              <span>{getMeetingDateTimeLabel().end}</span>
                            </div>
                            <Textarea
                              value={scheduleActivityNote}
                              onChange={(event) => setScheduleActivityNote(event.target.value)}
                              placeholder="Add meeting notes..."
                              rows={4}
                              className="min-h-[96px] resize-none border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {meetingEditorState ? (
                      <div className="absolute inset-0 z-20 flex items-start justify-center bg-white/55 px-4 py-6 backdrop-blur-[1px]">
                        <div className="flex max-h-[calc(100vh-120px)] w-full max-w-[520px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,0.3)]">
                          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <h3 className="text-[18px] font-semibold text-slate-900">New Event</h3>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="text-slate-400 transition hover:text-slate-900"
                                onClick={() => toast("Expanded meeting editor is not available yet")}
                                aria-label="Expand event editor"
                              >
                                <Maximize2 className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                className="text-slate-400 transition hover:text-slate-900"
                                onClick={closeMeetingEventEditor}
                                aria-label="Close event editor"
                              >
                                <X className="h-5 w-5" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4 overflow-y-auto px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Tag className="h-5 w-5 shrink-0 text-slate-400" />
                              <Input
                                value={meetingEditorState.summary}
                                onChange={(event) =>
                                  setMeetingEditorState((current) =>
                                    current ? { ...current, summary: event.target.value } : current
                                  )
                                }
                                className="h-10 rounded-none border-0 border-b border-sky-500 bg-transparent px-0 text-[17px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-slate-900">
                              <Clock3 className="h-5 w-5 shrink-0 text-slate-400" />
                              <Input
                                type="date"
                                value={meetingEditorState.dueDate}
                                onChange={(event) =>
                                  setMeetingEditorState((current) =>
                                    current ? { ...current, dueDate: event.target.value } : current
                                  )
                                }
                                className="h-10 w-[156px] border-slate-200 bg-white text-sm text-slate-900"
                              />
                              <Input
                                type="time"
                                value={meetingEditorState.meetingTime}
                                onChange={(event) =>
                                  setMeetingEditorState((current) =>
                                    current ? { ...current, meetingTime: event.target.value } : current
                                  )
                                }
                                className="h-10 w-[110px] border-slate-200 bg-white text-sm text-slate-900"
                              />
                              <span className="text-lg text-slate-300">→</span>
                              <Input
                                type="time"
                                value={meetingEditorState.meetingEndTime}
                                onChange={(event) =>
                                  setMeetingEditorState((current) =>
                                    current ? { ...current, meetingEndTime: event.target.value } : current
                                  )
                                }
                                className="h-10 w-[110px] border-slate-200 bg-white text-sm text-slate-900"
                              />
                              <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-600">
                                <input type="checkbox" readOnly className="h-4 w-4 rounded border-slate-300 bg-white" />
                                All day
                              </label>
                            </div>

                            <div className="flex items-center gap-3">
                              <Users className="h-5 w-5 shrink-0 text-slate-400" />
                              <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-2 text-sm font-medium text-rose-700">
                                <span>{meetingEditorAssignee?.name ?? "Employee"}</span>
                                <button
                                  type="button"
                                  className="text-rose-500 transition hover:text-rose-700"
                                  onClick={() => toast("Attendee editing is available from Assigned to")}
                                  aria-label="Manage attendee"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <MapPin className="h-5 w-5 shrink-0 text-slate-400" />
                                <span className="truncate text-base text-slate-500">Room or Location</span>
                              </div>
                              <button
                                type="button"
                                className="text-base font-semibold text-sky-600 transition hover:text-sky-700"
                                onClick={() => toast("Video conference is not available yet")}
                              >
                                + Video conference
                              </button>
                            </div>

                            <div className="flex items-center gap-3 text-base text-slate-500">
                              <Lock className="h-5 w-5" />
                              <span>Public</span>
                            </div>

                            <div className="flex items-center gap-3 text-base text-slate-900">
                              <Circle className="h-4 w-4 fill-slate-400 text-slate-400" />
                              <span>Busy</span>
                            </div>

                            <div className="flex items-start gap-3">
                              <FileText className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
                              <Textarea
                                value={meetingEditorState.note}
                                onChange={(event) =>
                                  setMeetingEditorState((current) =>
                                    current ? { ...current, note: event.target.value } : current
                                  )
                                }
                                placeholder="Notes"
                                className="min-h-[82px] resize-none border-0 bg-transparent px-0 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <Button
                                type="button"
                                className="bg-sky-600 text-white hover:bg-sky-700"
                                onClick={handleMeetingEventEditorSave}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                onClick={() => toast("More options are not available yet")}
                              >
                                More Options
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                              onClick={closeMeetingEventEditor}
                            >
                              Discard
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex min-h-[430px] items-center justify-center rounded-md border border-slate-200 bg-white shadow-sm">
                    <div className="flex max-w-[420px] flex-col items-center gap-5 px-6 text-center">
                      <div className="flex h-32 w-32 items-center justify-center rounded-[28px] bg-slate-100 text-slate-400">
                        <CalendarDays className="h-20 w-20 stroke-[1.5]" />
                      </div>
                      <p className="text-[28px] font-medium leading-tight text-slate-500">
                        Schedule a meeting in your calendar
                      </p>
                    </div>
                  </div>
                )
              ) : (
                <div className="space-y-5 rounded-md border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)] md:items-end">
                      <span className="text-[17px] font-semibold text-slate-900">Summary</span>
                      <Input
                        value={scheduleActivitySummary}
                        onChange={(event) => setScheduleActivitySummary(event.target.value)}
                        className="h-11 rounded-none border-0 border-b border-sky-500 bg-transparent px-0 text-[17px] font-medium text-slate-900 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div className="space-y-5 px-5 pb-6">
                    <div className="grid gap-5 md:grid-cols-[110px_minmax(0,1fr)] md:items-center">
                      <span className="text-[15px] font-semibold text-slate-700">Due Date</span>
                      <Input
                        type="date"
                        value={scheduleActivityDueDate}
                        onChange={(event) => setScheduleActivityDueDate(event.target.value)}
                        className="h-10 max-w-[180px] border-slate-200 bg-white text-[15px] text-slate-900"
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-[110px_minmax(0,1fr)] md:items-center">
                      <span className="text-[15px] font-semibold text-slate-700">Assigned to</span>
                      <div ref={scheduleAssigneePickerRef} className="relative w-full max-w-[320px]">
                        <button
                          type="button"
                          onClick={() => setIsScheduleAssigneePopoverOpen((current) => !current)}
                          className="flex h-12 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 text-left text-slate-900 shadow-sm transition hover:bg-slate-50"
                          aria-label="Choose assigned employee"
                          aria-expanded={isScheduleAssigneePopoverOpen}
                          aria-haspopup="listbox"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                                selectedScheduleEmployee ? kanbanPanelColors[selectedScheduleEmployee.role] : "bg-slate-500"
                              )}
                            >
                              {selectedScheduleEmployee?.name.trim().charAt(0).toUpperCase() ?? "E"}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-medium text-slate-900">
                                {selectedScheduleEmployee?.name ?? "Employee"}
                              </p>
                            </div>
                          </div>
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 shrink-0 text-slate-500 transition-transform",
                              isScheduleAssigneePopoverOpen && "rotate-180"
                            )}
                          />
                        </button>
                        {isScheduleAssigneePopoverOpen ? (
                          <div
                            className="absolute left-0 top-full z-30 mt-2 w-[320px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                            role="listbox"
                            aria-label="Choose assigned employee"
                          >
                            <div className="max-h-[300px] overflow-y-auto py-2">
                              {employeesWithSummary.map((employee) => (
                                <button
                                  key={employee.id}
                                  type="button"
                                  onClick={() => handleScheduleAssigneeChange(employee.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-slate-50",
                                    selectedScheduleEmployee?.id === employee.id ? "bg-sky-50" : "bg-white"
                                  )}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div
                                      className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white",
                                        kanbanPanelColors[employee.role]
                                      )}
                                    >
                                      {employee.name.trim().charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-slate-900">{employee.name}</p>
                                      <p className="truncate text-xs text-slate-500">{employee.email}</p>
                                    </div>
                                  </div>
                                  {selectedScheduleEmployee?.id === employee.id ? (
                                    <Check className="h-4 w-4 shrink-0 text-sky-600" />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Textarea
                      value={scheduleActivityNote}
                      onChange={(event) => setScheduleActivityNote(event.target.value)}
                      placeholder="Log a note..."
                      className="min-h-[140px] resize-none border-0 bg-transparent px-0 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-0"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {!showMeetingCalendar ? (
            <DialogFooter className="border-t border-slate-200 px-5 py-5 sm:justify-start">
              {selectedScheduleActivityType === "meeting" ? (
                <Button type="button" className="bg-violet-600 text-white hover:bg-violet-700" onClick={handleScheduleMeeting}>
                  Schedule
                </Button>
              ) : null}
              <Button type="button" className="bg-sky-600 text-white hover:bg-sky-700" onClick={handleScheduleActivitySave}>
                Save
              </Button>
              <Button type="button" variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={handleScheduleActivityMarkDone}>
                Mark Done
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200">
                  Discard
                </Button>
              </DialogClose>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
