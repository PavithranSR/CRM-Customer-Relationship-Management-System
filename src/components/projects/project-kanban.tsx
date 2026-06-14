"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { Priority, ProjectStatus, ProjectType, Role } from "@prisma/client";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Loader2, Lock, Mail, MapPin, Maximize2, MoreHorizontal, Pencil, Phone, Plus, Settings, Tag, Trash2, UserRound, X } from "lucide-react";
import { addDays, addHours, differenceInCalendarDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { assignEmployee, getAvailableEmployees } from "@/actions/assignment.actions";
import {
  createProjectStage,
  deleteProject,
  deleteProjectStage,
  renameProjectStage,
  updateProjectStage,
} from "@/actions/project.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Stage {
  id: string;
  name: string;
  sortOrder: number;
}

interface ProjectPerson {
  id: string;
  name: string;
  email?: string | null;
  role?: Role | null;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  isActive?: boolean;
  hireDate?: Date | string | null;
}

interface Project {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  client?: {
    id: string;
    name: string;
    collegeName?: string | null;
  } | null;
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
  status?: ProjectStatus;
  priority: Priority;
  progress: number;
  estimatedHours?: number | null;
  startDate?: Date | null;
  deadline: Date | null;
  managerId?: string | null;
  stageId: string | null;
  stage: { id: string; name: string; sortOrder: number } | null;
  manager: ProjectPerson | null;
  assignments: { user: ProjectPerson }[];
  _count: { timeEntries: number };
  taskCount: number;
}

interface LeadProfileState {
  person: ProjectPerson;
  projectName: string;
  projectCode: string;
  taskCount: number;
}

interface AvailableLeadOption extends ProjectPerson {
  role: Role;
}

interface ProjectKanbanProps {
  projects: Project[];
  stages: Stage[];
  groupByManager?: boolean;
  canEdit: boolean;
  canCreateStages?: boolean;
  canUpdateStages?: boolean;
  canDeleteStages?: boolean;
  canEditProjects?: boolean;
  canDeleteProjects?: boolean;
  canAssignProjectLead?: boolean;
  showTlDetailsMenu?: boolean;
}

const STAGE_THEMES = [
  "bg-cyan-50 border-cyan-200",
  "bg-blue-50 border-blue-200",
  "bg-amber-50 border-amber-200",
  "bg-emerald-50 border-emerald-200",
  "bg-rose-50 border-rose-200",
  "bg-violet-50 border-violet-200",
] as const;

const FOLDED_STAGE_THEMES = [
  "border-cyan-200 bg-gradient-to-b from-cyan-50 via-cyan-50/95 to-white",
  "border-blue-200 bg-gradient-to-b from-blue-50 via-blue-50/95 to-white",
  "border-amber-200 bg-gradient-to-b from-amber-50 via-amber-50/95 to-white",
  "border-emerald-200 bg-gradient-to-b from-emerald-50 via-emerald-50/95 to-white",
  "border-rose-200 bg-gradient-to-b from-rose-50 via-rose-50/95 to-white",
  "border-violet-200 bg-gradient-to-b from-violet-50 via-violet-50/95 to-white",
] as const;

const PROJECT_KANBAN_FOLDED_STAGES_STORAGE_KEY = "project-kanban-folded-stages";

function readStoredFoldedStages(): Record<string, boolean> {
  if (typeof window === "undefined") {
    return {};
  }

  const storedValue = window.localStorage.getItem(PROJECT_KANBAN_FOLDED_STAGES_STORAGE_KEY);
  if (!storedValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(storedValue);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, boolean] => typeof entry[0] === "string" && typeof entry[1] === "boolean"
      )
    );
  } catch {
    window.localStorage.removeItem(PROJECT_KANBAN_FOLDED_STAGES_STORAGE_KEY);
    return {};
  }
}

const ACTIVITY_TYPES = [
  "To-Do",
  "Email",
  "Call",
  "Meeting",
  "Document",
  "Request Signature",
] as const;

const MEETING_TIME_SLOTS = [
  "6am",
  "7am",
  "8am",
  "9am",
  "10am",
  "11am",
  "12pm",
  "1pm",
  "2pm",
  "3pm",
  "4pm",
  "5pm",
  "6pm",
  "7pm",
  "8pm",
  "9pm",
  "10pm",
  "11pm",
] as const;

type ActivityType = (typeof ACTIVITY_TYPES)[number];

interface MeetingSlotDraft {
  day: Date;
  timeLabel: string;
}

type MeetingCalendarView = "day" | "week" | "month" | "year";

interface ScheduledProjectActivity {
  id: string;
  type: ActivityType;
  assignee: string;
  dueDate?: Date;
  note: string;
  status: "planned" | "done";
}

export function ProjectKanban({
  projects,
  stages,
  groupByManager = false,
  canEdit,
  canCreateStages = false,
  canUpdateStages = false,
  canDeleteStages = false,
  canEditProjects = false,
  canDeleteProjects = false,
  canAssignProjectLead = false,
  showTlDetailsMenu = false,
}: ProjectKanbanProps) {
  const FOLDED_STAGE_WIDTH = 42;
  const DEFAULT_STAGE_WIDTH = 280;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localProjects, setLocalProjects] = useState(projects);
  const [foldedStages, setFoldedStages] = useState<Record<string, boolean>>({});
  const [hasLoadedFoldedStages, setHasLoadedFoldedStages] = useState(false);
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [activityOpenProjectId, setActivityOpenProjectId] = useState<string | null>(null);
  const [leadAssignProjectId, setLeadAssignProjectId] = useState<string | null>(null);
  const [availableTeamLeads, setAvailableTeamLeads] = useState<AvailableLeadOption[]>([]);
  const [isLeadOptionsLoading, setIsLeadOptionsLoading] = useState(false);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);
  const [selectedLeadProfile, setSelectedLeadProfile] = useState<LeadProfileState | null>(null);
  const [scheduleDialogProject, setScheduleDialogProject] = useState<Project | null>(null);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>("To-Do");
  const [activityNote, setActivityNote] = useState("");
  const [showMeetingCalendar, setShowMeetingCalendar] = useState(false);
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingEndTime, setMeetingEndTime] = useState("11:00");
  const [meetingViewDate, setMeetingViewDate] = useState(new Date());
  const [meetingSlotDraft, setMeetingSlotDraft] = useState<MeetingSlotDraft | null>(null);
  const [meetingAvailability, setMeetingAvailability] = useState<"available" | "busy">("busy");
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [meetingCalendarView, setMeetingCalendarView] = useState<MeetingCalendarView>("week");
  const [showWeekends, setShowWeekends] = useState(true);
  const [activityDueDate, setActivityDueDate] = useState<Date | undefined>(undefined);
  const [activityDueDateOpen, setActivityDueDateOpen] = useState(false);
  const [projectActivities, setProjectActivities] = useState<
    Record<string, ScheduledProjectActivity[]>
  >({});
  const signatureFileInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteStageTarget, setDeleteStageTarget] = useState<{ id: string; name: string } | null>(
    null
  );

  useEffect(() => {
    setLocalProjects(projects);
  }, [projects]);

  useEffect(() => {
    setFoldedStages(readStoredFoldedStages());
    setHasLoadedFoldedStages(true);
  }, []);

  useEffect(() => {
    if (!leadAssignProjectId || !canAssignProjectLead) {
      setAvailableTeamLeads([]);
      setIsLeadOptionsLoading(false);
      return;
    }

    let active = true;
    setIsLeadOptionsLoading(true);

    getAvailableEmployees(leadAssignProjectId)
      .then((employees) => {
        if (!active) {
          return;
        }

        setAvailableTeamLeads(
          employees.filter((employee) => employee.role === "TEAMLEADER") as AvailableLeadOption[]
        );
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setAvailableTeamLeads([]);
        toast.error("Unable to load available team leaders");
      })
      .finally(() => {
        if (active) {
          setIsLeadOptionsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [leadAssignProjectId, canAssignProjectLead]);

  useEffect(() => {
    const validStageIds = new Set(stages.map((stage) => stage.id));
    setFoldedStages((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([stageId, isFolded]) => validStageIds.has(stageId) && isFolded)
      );

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [stages]);

  useEffect(() => {
    if (!hasLoadedFoldedStages || typeof window === "undefined") {
      return;
    }

    if (Object.keys(foldedStages).length === 0) {
      window.localStorage.removeItem(PROJECT_KANBAN_FOLDED_STAGES_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(PROJECT_KANBAN_FOLDED_STAGES_STORAGE_KEY, JSON.stringify(foldedStages));
  }, [foldedStages, hasLoadedFoldedStages]);

  const orderedStages = useMemo(
    () => [...stages].sort((a, b) => a.sortOrder - b.sortOrder),
    [stages]
  );

  const resolveStageId = (project: Project) => {
    if (project.stageId) return project.stageId;
    return orderedStages[0]?.id ?? null;
  };

  const moveProjectLocal = (projectId: string, nextStageId: string) => {
    setLocalProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, stageId: nextStageId } : project
      )
    );
  };

  const handleStageMove = (project: Project, nextStageId: string) => {
    const previousStageId = resolveStageId(project);
    if (!previousStageId || previousStageId === nextStageId) return;

    moveProjectLocal(project.id, nextStageId);

    startTransition(async () => {
      const result = await updateProjectStage(project.id, nextStageId);
      if (result.error) {
        moveProjectLocal(project.id, previousStageId);
        toast.error(result.error);
      } else {
        toast.success("Project moved");
      }
    });
  };

  const handleDeleteStage = (stageId: string, stageName: string) => {
    setDeleteStageTarget({ id: stageId, name: stageName });
  };

  const handleConfirmDeleteStage = () => {
    if (!deleteStageTarget) return;
    const { id } = deleteStageTarget;

    startTransition(async () => {
      const result = await deleteProjectStage(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stage deleted");
      }
      setDeleteStageTarget(null);
    });
  };

  const startEditStage = (stage: Stage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const cancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveEditStage = () => {
    if (!editingStageId) return;
    const name = editingStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    startTransition(async () => {
      const result = await renameProjectStage(editingStageId, name);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Stage updated");
        cancelEditStage();
      }
    });
  };

  const handleConfirmAddStage = () => {
    const name = newStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("name", name);

    startTransition(async () => {
      const result = await createProjectStage(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Stage added");
      setNewStageName("");
      setShowAddStageInput(false);
    });
  };

  const handleCancelAddStage = () => {
    setNewStageName("");
    setShowAddStageInput(false);
  };

  const handleDragStart = (projectId: string, event: DragEvent<HTMLDivElement>) => {
    setDraggedProjectId(projectId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
  };

  const handleDragOver = (stageId: string, event: DragEvent<HTMLDivElement>) => {
    if (!canEdit || isPending) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStageId(stageId);
  };

  const handleDrop = (nextStageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverStageId(null);

    if (!canEdit || isPending) return;

    const droppedProjectId = event.dataTransfer.getData("text/plain") || draggedProjectId;
    if (!droppedProjectId) return;

    const project = localProjects.find((item) => item.id === droppedProjectId);
    if (!project) return;

    handleStageMove(project, nextStageId);
  };

  const handleDragEnd = () => {
    setDraggedProjectId(null);
    setDragOverStageId(null);
  };

  const toggleStageFold = (stageId: string) => {
    setFoldedStages((prev) => ({
      ...prev,
      [stageId]: !prev[stageId],
    }));
  };

  const handleDeleteProject = () => {
    if (!deleteProjectId) return;

    startTransition(async () => {
      const result = await deleteProject(deleteProjectId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLocalProjects((current) =>
          current.filter((project) => project.id !== deleteProjectId)
        );
        toast.success("Project deleted successfully");
      }
      setDeleteProjectId(null);
    });
  };

  const handleScheduleDialogClose = (open: boolean) => {
    if (!open) {
      setScheduleDialogProject(null);
      setEditingActivityId(null);
      setSelectedActivityType("To-Do");
      setActivityNote("");
      setShowMeetingCalendar(false);
      setMeetingDate(undefined);
      setMeetingTime("10:00");
      setMeetingEndTime("11:00");
      setMeetingViewDate(new Date());
      setMeetingSlotDraft(null);
      setMeetingAvailability("busy");
      setTimePickerOpen(false);
      setMeetingCalendarView("week");
      setShowWeekends(true);
      setActivityDueDate(undefined);
      setActivityDueDateOpen(false);
    }
  };

  const getProjectLead = (project: Project) => {
    const assignedTeamLeader = project.assignments.find(
      (assignment) => assignment.user.role === "TEAMLEADER"
    )?.user;

    return assignedTeamLeader ?? project.manager ?? project.assignments[0]?.user ?? null;
  };

  const getAssignedName = (project: Project) => getProjectLead(project)?.name ?? "Unassigned";
  const getProjectTasksHref = (projectId: string) => `/projects/${projectId}?view=kanban`;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U";

  const getAvatarLetter = (name: string) => name.trim().charAt(0).toUpperCase() || "U";

  const getRoleLabel = (role?: Role | null) => {
    switch (role) {
      case "TEAMLEADER":
        return "Team Leader";
      case "BA":
        return "Business Analyst";
      case "ADMIN":
        return "Admin";
      case "EMPLOYEE":
        return "Employee";
      default:
        return "Project Lead";
    }
  };

  const handleAssignProjectLead = async (projectId: string, leader: AvailableLeadOption) => {
    setAssigningLeadId(leader.id);

    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("userId", leader.id);
      formData.append("role", "PROJECT_LEAD");

      const result = await assignEmployee(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
        return;
      }

      setLocalProjects((current) =>
        current.map((project) => {
          if (project.id !== projectId) {
            return project;
          }

          const existingAssignment = project.assignments.find(
            (assignment) => assignment.user.id === leader.id
          );

          const nextAssignments = existingAssignment
            ? project.assignments.map((assignment) =>
                assignment.user.id === leader.id
                  ? {
                      ...assignment,
                      user: {
                        ...assignment.user,
                        ...leader,
                        isActive: true,
                      },
                    }
                  : assignment
              )
            : [
                ...project.assignments,
                {
                  user: {
                    ...leader,
                    isActive: true,
                  },
                },
              ];

          return {
            ...project,
            assignments: nextAssignments,
          };
        })
      );

      setLeadAssignProjectId(null);
      toast.success(`${leader.name} assigned as team leader`);
      router.refresh();
    } finally {
      setAssigningLeadId(null);
    }
  };

  const getActivityDueText = (activity: ScheduledProjectActivity) => {
    if (!activity.dueDate) return "No due date";

    const today = new Date();
    const dueDate = new Date(activity.dueDate);
    const dayDelta = differenceInCalendarDays(dueDate, today);

    if (dayDelta === 0) return "Due today";
    if (dayDelta === 1) return "Due tomorrow";
    if (dayDelta > 1 && dayDelta <= 14) return `Due in ${dayDelta} days`;
    if (dayDelta === -1) return "Due yesterday";
    if (dayDelta < -1 && dayDelta >= -14) return `${Math.abs(dayDelta)} days overdue`;
    return `Due ${format(dueDate, "d MMM")}`;
  };

  const openScheduleDialog = (projectId: string) => {
    const project = localProjects.find((item) => item.id === projectId) ?? null;
    setActivityOpenProjectId(null);
    setEditingActivityId(null);
    setSelectedActivityType("To-Do");
    setActivityNote("");
    setShowMeetingCalendar(false);
    setMeetingDate(undefined);
    setMeetingTime("10:00");
    setMeetingEndTime("11:00");
    setMeetingViewDate(project?.deadline ? new Date(project.deadline) : new Date());
    setMeetingSlotDraft(null);
    setMeetingAvailability("busy");
    setTimePickerOpen(false);
    setMeetingCalendarView("week");
    setShowWeekends(true);
    setActivityDueDate(project?.deadline ? new Date(project.deadline) : undefined);
    setActivityDueDateOpen(false);
    setScheduleDialogProject(project);
  };

  const openEditActivityDialog = (projectId: string, activity: ScheduledProjectActivity) => {
    const project = localProjects.find((item) => item.id === projectId) ?? null;
    if (!project) return;

    setActivityOpenProjectId(null);
    setEditingActivityId(activity.id);
    setSelectedActivityType(activity.type);
    setActivityNote(activity.note);
    setShowMeetingCalendar(activity.type === "Meeting");
    setMeetingDate(activity.dueDate ? new Date(activity.dueDate) : undefined);
    setMeetingTime(activity.dueDate ? format(new Date(activity.dueDate), "HH:mm") : "10:00");
    setMeetingEndTime(
      activity.dueDate ? format(addHours(new Date(activity.dueDate), 1), "HH:mm") : "11:00"
    );
    setMeetingViewDate(activity.dueDate ? new Date(activity.dueDate) : new Date());
    setMeetingSlotDraft(null);
    setMeetingAvailability("busy");
    setTimePickerOpen(false);
    setMeetingCalendarView("week");
    setShowWeekends(true);
    setActivityDueDate(activity.dueDate ? new Date(activity.dueDate) : undefined);
    setActivityDueDateOpen(false);
    setScheduleDialogProject(project);
  };

  const saveProjectActivity = (status: "planned" | "done") => {
    if (!scheduleDialogProject) return false;

    const dueDate = selectedActivityType === "Meeting" ? meetingDate : activityDueDate;
    const projectId = scheduleDialogProject.id;
    const nextActivity: ScheduledProjectActivity = {
      id: `${projectId}-${Date.now()}`,
      type: selectedActivityType,
      assignee: getAssignedName(scheduleDialogProject),
      dueDate,
      note: activityNote.trim(),
      status,
    };

    setProjectActivities((prev) => ({
      ...prev,
      [projectId]: editingActivityId
        ? (prev[projectId] ?? []).map((activity) =>
            activity.id === editingActivityId ? { ...nextActivity, id: editingActivityId } : activity
          )
        : [nextActivity, ...(prev[projectId] ?? [])],
    }));

    return true;
  };

  const handleSaveActivity = () => {
    if (!scheduleDialogProject || !saveProjectActivity("planned")) return;
    toast.success(`Activity saved for ${scheduleDialogProject.name}`);
    handleScheduleDialogClose(false);
  };

  const handleMarkDoneActivity = () => {
    if (!scheduleDialogProject || !saveProjectActivity("done")) return;
    toast.success(`Activity marked done for ${scheduleDialogProject.name}`);
    handleScheduleDialogClose(false);
  };

  const handleScheduleMeeting = () => {
    if (meetingDate) {
      setMeetingViewDate(meetingDate);
    }
    setShowMeetingCalendar(true);
  };

  const updateProjectActivityStatus = (
    projectId: string,
    activityId: string,
    status: ScheduledProjectActivity["status"]
  ) => {
    setProjectActivities((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).map((activity) =>
        activity.id === activityId ? { ...activity, status } : activity
      ),
    }));
  };

  const removeProjectActivity = (projectId: string, activityId: string) => {
    setProjectActivities((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? []).filter((activity) => activity.id !== activityId),
    }));
  };

  const parseTimeLabel = (timeLabel: string) => {
    const [hourPart, periodPart] = [parseInt(timeLabel, 10), timeLabel.slice(-2)];
    if (periodPart === "am") {
      return hourPart === 12 ? 0 : hourPart;
    }
    return hourPart === 12 ? 12 : hourPart + 12;
  };

  const openMeetingSlotDraft = (day: Date, timeLabel: string) => {
    const hour = parseTimeLabel(timeLabel);
    const slotDate = new Date(day);
    slotDate.setHours(hour, 0, 0, 0);
    setMeetingDate(slotDate);
    setMeetingTime(format(slotDate, "HH:mm"));
    setMeetingEndTime(format(addHours(slotDate, 1), "HH:mm"));
    setMeetingSlotDraft({ day, timeLabel });
    setMeetingAvailability("busy");
    setTimePickerOpen(false);
  };

  const getEventDateTimeLabel = () => {
    if (!meetingDate) {
      return { date: "Choose date", start: "10:00 am", end: "11:00 am" };
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

  const meetingWeekStart = useMemo(
    () => startOfWeek(meetingViewDate, { weekStartsOn: 0 }),
    [meetingViewDate]
  );

  const meetingWeekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(meetingWeekStart, index)),
    [meetingWeekStart]
  );

  const visibleMeetingDays = useMemo(() => {
    if (meetingCalendarView === "day") {
      return [meetingViewDate];
    }

    if (meetingCalendarView === "week") {
      return showWeekends
        ? meetingWeekDays
        : meetingWeekDays.filter((day) => !["Sun", "Sat"].includes(format(day, "EEE")));
    }

    return [];
  }, [meetingCalendarView, meetingViewDate, meetingWeekDays, showWeekends]);

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

  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(meetingViewDate.getFullYear(), index, 1);
      return {
        date: monthDate,
        label: format(monthDate, "MMM"),
      };
    }),
    [meetingViewDate]
  );

  const assignedName = scheduleDialogProject ? getAssignedName(scheduleDialogProject) : "Unassigned";

  const handleSignatureUploadClick = () => {
    signatureFileInputRef.current?.click();
  };

  const handleSignatureFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      toast.success(`Selected PDF: ${file.name}`);
    }
    event.target.value = "";
  };

  const groupedProjectsByLead = useMemo(() => {
    const grouped = new Map<string, Project[]>();

    for (const project of localProjects) {
      const assignedTeamLeader = project.assignments.find(
        (assignment) => assignment.user.role === "TEAMLEADER"
      )?.user;
      const leadName =
        assignedTeamLeader?.name ?? project.manager?.name ?? project.assignments[0]?.user.name ?? "Unassigned";
      const current = grouped.get(leadName) ?? [];
      current.push(project);
      grouped.set(leadName, current);
    }

    return Array.from(grouped.entries()).map(([leadName, groupedProjects]) => ({
      leadName,
      projects: groupedProjects,
    }));
  }, [localProjects]);

  const renderProjectCard = (project: Project, disableDrag = false) => {
    const plannedActivities = (projectActivities[project.id] ?? []).filter(
      (activity) => activity.status === "planned"
    );
    const projectLead = getProjectLead(project);
    const clientLabel = project.client?.name?.trim();
    const clientCollege = project.client?.collegeName?.trim();
    const clientDisplayLabel = clientLabel
      ? clientCollege
        ? `${clientLabel} • ${clientCollege}`
        : clientLabel
      : "Client not assigned";
    const canDragProject = canEdit && !isPending && !disableDrag;

    return (
      <Card
        key={project.id}
        className={`gap-0 rounded-none border-x border-b border-t-0 border-slate-400 py-0 shadow-none first:rounded-t-none first:border-t ${canDragProject ? "cursor-grab active:cursor-grabbing" : ""}`}
        draggable={canDragProject}
        onDragStart={(event) => handleDragStart(project.id, event)}
        onDragEnd={handleDragEnd}
      >
        <CardHeader className="px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex flex-1 flex-nowrap items-center gap-2">
              <CardTitle className="min-w-0 flex-1 truncate text-base leading-tight">
                <Link
                  href={getProjectTasksHref(project.id)}
                  className="truncate hover:underline"
                >
                  {project.name}
                </Link>
              </CardTitle>
              <p className="shrink-0 text-[11px] text-muted-foreground">{project.code}</p>
            </div>
            {(canEditProjects || canDeleteProjects) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    draggable={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    disabled={isPending}
                    aria-label="Project actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[8.5rem] rounded-lg p-1"
                >
                  <DropdownMenuItem asChild className="gap-2 rounded-md px-2 py-1.5 text-sm">
                    <Link href={`/projects/${project.id}?view=details`}>
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  {canDeleteProjects ? (
                    <DropdownMenuItem
                      className="gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 focus:text-red-600"
                      onClick={() => setDeleteProjectId(project.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {!canEditProjects && !canDeleteProjects && showTlDetailsMenu && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Project options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${project.id}?view=details`}>
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p className="truncate text-[11px] text-slate-500" title={clientDisplayLabel}>
            {clientDisplayLabel}
          </p>
        </CardHeader>

        <CardContent className="space-y-2 px-2.5 pb-2">
          <div className="w-[78%] space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-2" />
          </div>

          <div className="flex items-end justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <p className="font-medium text-emerald-600">Tasks: {project.taskCount}</p>
              <Popover
                open={activityOpenProjectId === project.id}
                onOpenChange={(open) => setActivityOpenProjectId(open ? project.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    suppressHydrationWarning
                    type="button"
                    draggable={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    className="inline-flex h-5 w-5 items-center justify-center text-slate-500 transition hover:text-slate-700"
                    aria-label="Project activity"
                    title="Project activity"
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={10}
                  className="w-[320px] overflow-visible border-slate-200 bg-white p-0 text-slate-900 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.22)]"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <div className="absolute -top-1 left-4 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white" />
                  {plannedActivities.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                        <span className="text-lg font-semibold text-slate-900">Planned</span>
                        <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-700">
                          {plannedActivities.length}
                        </span>
                      </div>
                      <div className="max-h-[190px] overflow-y-auto">
                        {plannedActivities.slice(0, 3).map((activity) => (
                          <div
                            key={activity.id}
                            className="border-b border-slate-200 bg-white px-4 py-2.5"
                          >
                            <div className="mb-1.5 flex items-center justify-between gap-3">
                              <span className="text-base font-semibold text-slate-900">
                                {activity.note || activity.type}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateProjectActivityStatus(
                                      project.id,
                                      activity.id,
                                      "done"
                                    );
                                    toast.success(
                                      `${activity.type} marked done for ${project.name}`
                                    );
                                  }}
                                  className="text-slate-400 transition hover:text-emerald-600"
                                  aria-label="Mark activity done"
                                  title="Mark activity done"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openEditActivityDialog(project.id, activity)
                                  }
                                  className="text-slate-400 transition hover:text-slate-900"
                                  aria-label="Edit activity"
                                  title="Edit activity"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    removeProjectActivity(project.id, activity.id);
                                    toast.success(
                                      `${activity.type} canceled for ${project.name}`
                                    );
                                  }}
                                  className="text-slate-400 transition hover:text-red-500"
                                  aria-label="Cancel activity"
                                  title="Cancel activity"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 text-sm text-slate-600">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 text-[11px] font-semibold text-slate-700">
                                {getInitials(activity.assignee)}
                              </span>
                              <span className="font-medium">
                                {activity.assignee} - {getActivityDueText(activity)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-5 text-center text-sm italic text-slate-500">
                      Schedule activities to help you get things done.
                    </div>
                  )}
                  <button
                    type="button"
                    draggable={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={() => openScheduleDialog(project.id)}
                    className="flex w-full items-center justify-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[15px] font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Schedule an activity</span>
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            {!projectLead ? (
              !canAssignProjectLead ? (
                <span
                  className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300"
                  title="No TL assigned"
                >
                  <UserRound className="h-4 w-4" />
                </span>
              ) : (
                <Popover
                  open={leadAssignProjectId === project.id}
                  onOpenChange={(open) => setLeadAssignProjectId(open ? project.id : null)}
                >
                  <PopoverTrigger asChild>
                    <button
                      suppressHydrationWarning
                      type="button"
                      draggable={false}
                      onMouseDown={(event) => event.stopPropagation()}
                      onDragStart={(event) => event.preventDefault()}
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-300 hover:bg-white hover:text-slate-800"
                      aria-label={`Assign team leader for ${project.name}`}
                      title="Assign team leader"
                    >
                      <UserRound className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    side="top"
                    sideOffset={10}
                    className="w-[280px] border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.24)]"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                  >
                    <div className="border-b border-slate-200 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">Assign Team Leader</p>
                      <p className="mt-1 text-xs text-slate-500">{project.name}</p>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto p-2">
                      {isLeadOptionsLoading ? (
                        <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading team leaders...
                        </div>
                      ) : availableTeamLeads.length === 0 ? (
                        <div className="px-3 py-6 text-center text-sm text-slate-500">
                          No available team leaders.
                        </div>
                      ) : (
                        availableTeamLeads.map((leader) => (
                          <button
                            key={leader.id}
                            type="button"
                            onClick={() => handleAssignProjectLead(project.id, leader)}
                            disabled={assigningLeadId === leader.id}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#c89212] text-sm font-semibold text-white">
                              {getAvatarLetter(leader.name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {leader.name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {leader.email || "No email address"}
                              </span>
                            </span>
                            {assigningLeadId === leader.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    suppressHydrationWarning
                    type="button"
                    draggable={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-sm bg-[#c89212] text-[12px] font-semibold text-white transition hover:bg-[#b8840f]"
                    aria-label={`View ${projectLead.name} details`}
                    title={projectLead.name}
                  >
                    <span className="inline-flex items-center justify-center leading-none">
                      {getAvatarLetter(projectLead.name)}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="top"
                  sideOffset={10}
                  className="w-[340px] overflow-visible border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.24)]"
                  onOpenAutoFocus={(event) => event.preventDefault()}
                >
                  <div className="absolute -bottom-1 right-7 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white" />
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#c89212] text-[2rem] font-medium text-white">
                          {getAvatarLetter(projectLead.name)}
                        </div>
                        <span
                          className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${
                            projectLead.isActive === false ? "bg-slate-300" : "bg-emerald-500"
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[1.05rem] font-semibold text-slate-900">
                          {projectLead.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
                          {getRoleLabel(projectLead.role)}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[13px] text-cyan-600">
                          <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
                          <span className="truncate">
                            {projectLead.email || "No email address"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-5 border-y border-slate-100 py-3 text-sm text-slate-600">
                      <span className="font-semibold text-[#0f8b8d]">
                        {project.taskCount} Tasks
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        {project.code}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2.5">
                      {projectLead.email ? (
                        <Button
                          asChild
                          type="button"
                          className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
                        >
                          <a href={`mailto:${projectLead.email}`}>Send message</a>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          disabled
                          className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3.5 text-[12px] font-semibold text-slate-500"
                        >
                          Send message
                        </Button>
                      )}
                      <Button
                        type="button"
                        className="h-9 rounded-md border border-slate-200 bg-slate-100 px-3.5 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
                        onClick={() =>
                          setSelectedLeadProfile({
                            person: projectLead,
                            projectName: project.name,
                            projectCode: project.code,
                            taskCount: project.taskCount,
                          })
                        }
                      >
                        View Profile
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (orderedStages.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-muted-foreground">
        No stages configured
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex h-full min-h-0 min-w-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-auto pb-14">
          {groupByManager ? (
            localProjects.length === 0 ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                No projects match this grouping.
              </div>
            ) : (
              <div className="flex min-h-full min-w-max items-start gap-4 pb-2">
                {groupedProjectsByLead.map((group, groupIndex) => {
                  const leaderThemeClass = STAGE_THEMES[groupIndex % STAGE_THEMES.length];

                  return (
                    <section key={group.leadName} className="flex w-[320px] shrink-0 self-stretch flex-col">
                      <div
                        className={`sticky top-0 z-20 flex items-center justify-between gap-2 rounded-none border px-3 py-2 shadow-sm ${leaderThemeClass}`}
                      >
                        <div className="min-w-0">
                          <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                            {group.leadName}
                          </h3>
                          <p className="text-xs text-slate-500">Manager / Team Leader</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {group.projects.length}
                        </Badge>
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col">
                        {group.projects.map((project) => renderProjectCard(project, true))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )
          ) : (
            <>
          {orderedStages.map((stage, stageIndex) => {
              const stageProjects = localProjects.filter(
                (project) => resolveStageId(project) === stage.id
              );
              const themeClass = STAGE_THEMES[stageIndex % STAGE_THEMES.length];
              const foldedThemeClass = FOLDED_STAGE_THEMES[stageIndex % FOLDED_STAGE_THEMES.length];
              const isDropTarget = dragOverStageId === stage.id;
              const isFolded = foldedStages[stage.id] ?? false;

              return (
                <div
                  key={stage.id}
                  style={{ width: isFolded ? FOLDED_STAGE_WIDTH : DEFAULT_STAGE_WIDTH }}
                  className={`flex shrink-0 flex-col ${isFolded ? "min-w-[42px] self-start" : "min-h-full min-w-[220px] self-stretch"}`}
                >
                  {isFolded ? (
                    <button
                      type="button"
                      className={`sticky top-0 z-20 flex min-h-[220px] flex-1 flex-col items-center rounded-none px-1.5 py-2 text-slate-700 shadow-none transition hover:brightness-[0.99] ${foldedThemeClass}`}
                      onClick={() => toggleStageFold(stage.id)}
                      disabled={isPending}
                      aria-label={`Unfold ${stage.name} stage`}
                    >
                      <div className="flex h-6 w-6 items-center justify-center text-slate-700">
                        <div className="flex items-center">
                          <ChevronLeft className="h-4 w-4" />
                          <ChevronRight className="-ml-2 h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-1 items-center justify-center">
                        <p
                          className="text-base font-semibold tracking-tight text-slate-700 [writing-mode:vertical-rl]"
                          style={{ transform: "rotate(180deg)" }}
                        >
                          {stage.name} ({stageProjects.length})
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div
                      className={`sticky top-0 z-20 flex items-center justify-between gap-2 rounded-none border px-3 py-2 shadow-sm ${themeClass}`}
                      draggable={false}
                    >
                      <div className="min-w-0 flex flex-1 items-center gap-2">
                        {editingStageId === stage.id ? (
                          <Input
                            value={editingStageName}
                            onChange={(event) => setEditingStageName(event.target.value)}
                            className="h-8 min-w-0 w-full max-w-[10rem]"
                            autoFocus
                            disabled={isPending}
                          />
                        ) : (
                          <h3 className="truncate text-lg font-semibold tracking-tight">{stage.name}</h3>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">{stageProjects.length}</Badge>
                        {canUpdateStages && editingStageId === stage.id && (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={saveEditStage}
                              disabled={isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={cancelEditStage}
                              disabled={isPending}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {editingStageId !== stage.id && (canUpdateStages || canDeleteStages) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={isPending}
                                aria-label={`${stage.name} stage settings`}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem
                                onClick={() => toggleStageFold(stage.id)}
                                disabled={isPending}
                              >
                                <ChevronRight className="mr-2 h-4 w-4 rotate-90" />
                                Fold
                              </DropdownMenuItem>
                              {canUpdateStages ? (
                                <DropdownMenuItem
                                  onClick={() => startEditStage(stage)}
                                  disabled={isPending}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              ) : null}
                              {canDeleteStages && orderedStages.length > 1 ? (
                                <DropdownMenuItem
                                  onClick={() => handleDeleteStage(stage.id, stage.name)}
                                  disabled={isPending}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div
                    className={`${isFolded ? "hidden" : "flex min-h-0 flex-1 flex-col"} transition-colors ${isDropTarget ? "bg-muted/35" : ""}`}
                    onDragOver={(event) => handleDragOver(stage.id, event)}
                    onDrop={(event) => handleDrop(stage.id, event)}
                  >
                    {stageProjects.map((project) => renderProjectCard(project))}

                    {stageProjects.length === 0 && (
                      <div className="flex flex-1 items-center justify-center rounded-sm border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No projects in this stage
                      </div>
                    )}
                  </div>
                </div>
              );
          })}
          {canCreateStages ? (
            <div className="sticky right-0 top-0 z-20 flex w-10 shrink-0 self-start items-start justify-center bg-transparent">
              {showAddStageInput ? (
                <div className="absolute left-full top-0 w-[250px] border border-slate-300 bg-slate-100 shadow-sm">
                  <div className="border-b border-slate-300 bg-slate-100 p-2.5">
                    <p className="text-lg font-semibold tracking-tight text-slate-900">New Stage</p>
                    <p className="mt-1 text-xs text-slate-500">Create a new project stage</p>
                  </div>
                  <div className="space-y-2 p-2">
                    <Input
                      value={newStageName}
                      onChange={(event) => setNewStageName(event.target.value)}
                      placeholder="Stage name..."
                      className="h-9 bg-white"
                      autoFocus
                      disabled={isPending}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleConfirmAddStage}
                        className="h-8 px-3"
                        disabled={isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleCancelAddStage}
                        className="h-8 px-3"
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowAddStageInput(true)}
                  className="group flex h-full min-h-[220px] w-10 flex-col items-center justify-start gap-2 rounded-none bg-gradient-to-b from-slate-100 via-slate-50 to-white px-0 pt-1 text-slate-700 hover:from-slate-100 hover:via-slate-50 hover:to-white hover:text-slate-900"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="[writing-mode:vertical-rl] rotate-180 text-base leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                    Add Stage
                  </span>
                </Button>
              )}
            </div>
          ) : null}
            </>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteProjectId} onOpenChange={() => setDeleteProjectId(null)}>
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
            <AlertDialogAction
              onClick={handleDeleteProject}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!scheduleDialogProject} onOpenChange={handleScheduleDialogClose}>
        <DialogContent
          className={`max-h-[88vh] max-w-[90vw] overflow-hidden border-slate-200 bg-white p-0 text-slate-900 shadow-2xl ${
            selectedActivityType === "Request Signature" ? "sm:max-w-4xl" : "sm:max-w-6xl"
          }`}
          showCloseButton
        >
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle className="text-xl font-semibold text-slate-900">Schedule Activity</DialogTitle>
          </DialogHeader>
          <input
            ref={signatureFileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={handleSignatureFileChange}
          />

          {scheduleDialogProject ? (
            <>
              <div className="space-y-5 overflow-y-auto px-5 py-5">
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map((type) => {
                    const active = selectedActivityType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setSelectedActivityType(type);
                          if (type !== "Meeting") {
                            setShowMeetingCalendar(false);
                          }
                        }}
                        className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                          active
                            ? "border-cyan-500 bg-cyan-50 text-cyan-700 shadow-[inset_0_0_0_1px_rgba(6,182,212,0.18)]"
                            : "border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          {type}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedActivityType === "Meeting" ? (
                  showMeetingCalendar ? (
                    <div className="-mx-5 -mb-5 -mt-1 overflow-auto border-t border-slate-200 bg-white">
                      <div className="grid min-h-[520px] min-w-[980px] xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="relative border-r border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                  onClick={() => setMeetingViewDate(addDays(meetingViewDate, -7))}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  className="h-8 w-8 border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                  onClick={() => setMeetingViewDate(addDays(meetingViewDate, 7))}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-8 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-100"
                                  >
                                    {meetingCalendarView.charAt(0).toUpperCase() + meetingCalendarView.slice(1)}
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="start"
                                  className="min-w-[180px] border-slate-200 bg-white text-slate-900"
                                >
                                  <DropdownMenuRadioGroup
                                    value={meetingCalendarView}
                                    onValueChange={(value) => setMeetingCalendarView(value as MeetingCalendarView)}
                                  >
                                    <DropdownMenuRadioItem value="day" className="focus:bg-slate-100 focus:text-slate-900">
                                      Day
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="week" className="focus:bg-slate-100 focus:text-slate-900">
                                      Week
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="month" className="focus:bg-slate-100 focus:text-slate-900">
                                      Month
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="year" className="focus:bg-slate-100 focus:text-slate-900">
                                      Year
                                    </DropdownMenuRadioItem>
                                  </DropdownMenuRadioGroup>
                                  <div className="my-1 h-px bg-slate-200" />
                                  <DropdownMenuCheckboxItem
                                    checked={showWeekends}
                                    onCheckedChange={(checked) => setShowWeekends(Boolean(checked))}
                                    className="focus:bg-slate-100 focus:text-slate-900"
                                  >
                                    Show weekends
                                  </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-8 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-100"
                                onClick={() => setMeetingViewDate(new Date())}
                              >
                                Today
                              </Button>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl font-semibold text-slate-900">{format(meetingViewDate, "MMMM yyyy")}</span>
                                {meetingCalendarView === "week" ? (
                                  <span className="rounded-md bg-slate-900 px-2 py-1 text-sm font-semibold text-white">
                                    Week {format(meetingWeekStart, "I")}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                <span>Synchronize with</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-9 border-slate-300 bg-white px-3 text-sm text-slate-900 hover:bg-slate-100"
                                >
                                  <span className="rounded-sm bg-white px-1 py-0.5 text-xs font-bold text-slate-900">G</span>
                                  Google
                                </Button>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                className="h-9 border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-100"
                              >
                                Share
                              </Button>
                            </div>
                          </div>

                          {meetingCalendarView === "month" ? (
                            <div className="p-4">
                              <div className="grid grid-cols-7 border border-slate-700">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, index) => (
                                  <div key={`${label}-${index}`} className="border-b border-r border-slate-700 bg-[#2a2d39] px-3 py-2 text-center text-sm font-semibold text-white last:border-r-0">
                                    {label}
                                  </div>
                                ))}
                                {miniMonthDays.map((day) => {
                                  const inMonth = isSameMonth(day, meetingViewDate);
                                  const selected = isSameDay(day, meetingViewDate);
                                  return (
                                    <button
                                      key={day.toISOString()}
                                      type="button"
                                      onClick={() => {
                                        setMeetingViewDate(day);
                                        setMeetingDate(day);
                                      }}
                                      className={`min-h-[110px] border-r border-b border-slate-700 px-3 py-3 text-left transition ${
                                        selected ? "bg-[#38485a]" : "bg-[#2f3341] hover:bg-[#3a4050]"
                                      } ${inMonth ? "text-white" : "text-slate-500"} last:border-r-0`}
                                    >
                                      <div className="text-sm font-semibold">{format(day, "d")}</div>
                                      {isSameDay(day, meetingViewDate) ? (
                                        <div className="mt-4 text-xs text-cyan-300">Selected day</div>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : meetingCalendarView === "year" ? (
                            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                              {yearMonths.map((month) => {
                                const active = isSameMonth(month.date, meetingViewDate);
                                return (
                                  <button
                                    key={month.label}
                                    type="button"
                                    onClick={() => {
                                      setMeetingViewDate(month.date);
                                      setMeetingCalendarView("month");
                                    }}
                                    className={`rounded-lg border px-4 py-5 text-left transition ${
                                      active
                                        ? "border-cyan-400 bg-[#38485a] text-white"
                                        : "border-slate-700 bg-[#2f3341] text-slate-100 hover:bg-[#3a4050]"
                                    }`}
                                  >
                                    <p className="text-lg font-semibold">{month.label}</p>
                                    <p className="mt-1 text-sm text-slate-400">{format(month.date, "yyyy")}</p>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <>
                              <div
                                className="grid"
                                style={{ gridTemplateColumns: `60px repeat(${visibleMeetingDays.length}, minmax(0, 1fr))` }}
                              >
                                <div className="border-b border-r border-slate-700 bg-[#2a2d39]" />
                                {visibleMeetingDays.map((day) => (
                                  <div key={day.toISOString()} className="border-b border-r border-slate-700 bg-[#2a2d39] px-3 py-2 text-center last:border-r-0">
                                    <p className="text-sm font-semibold uppercase tracking-wide text-white">{format(day, "EEE")}</p>
                                    <div className="mt-1.5 flex justify-center">
                                      <span
                                        className={`flex h-10 w-10 items-center justify-center rounded-full text-2xl font-semibold ${
                                          isSameDay(day, meetingViewDate) ? "bg-red-600 text-white" : "text-slate-100"
                                        }`}
                                      >
                                        {format(day, "d")}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="max-h-[420px] overflow-y-auto">
                                <div
                                  className="grid"
                                  style={{ gridTemplateColumns: `60px repeat(${visibleMeetingDays.length}, minmax(0, 1fr))` }}
                                >
                                  {MEETING_TIME_SLOTS.map((timeLabel, rowIndex) => (
                                    <Fragment key={timeLabel}>
                                      <div className="border-r border-t border-slate-700 px-2 py-5 text-right text-base text-slate-100">
                                        {timeLabel}
                                      </div>
                                      {visibleMeetingDays.map((day) => {
                                        const isSelectedDay = isSameDay(day, meetingViewDate);
                                        const isMeetingRow = rowIndex === 5 && isSelectedDay;
                                        return (
                                          <div
                                            key={`${day.toISOString()}-${timeLabel}`}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => openMeetingSlotDraft(day, timeLabel)}
                                            onKeyDown={(event) => {
                                              if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault();
                                                openMeetingSlotDraft(day, timeLabel);
                                              }
                                            }}
                                            className={`relative min-h-[58px] border-r border-t border-slate-700 ${
                                              format(day, "EEE") === "Sun" || format(day, "EEE") === "Sat"
                                                ? "bg-white/10"
                                                : "bg-[#2f3341]"
                                            } cursor-pointer transition hover:bg-[#3a4050] last:border-r-0`}
                                          >
                                            {isMeetingRow ? (
                                              <div className="absolute inset-x-0 top-1/2 flex items-center">
                                                <div className="h-px flex-1 bg-red-500/40" />
                                                <span className="h-4 w-4 rounded-full bg-red-500" />
                                                <div className="h-px flex-1 bg-red-500" />
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </Fragment>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {meetingSlotDraft ? (
                            <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/20 px-4 pt-3 pb-6">
                              <div className="flex max-h-[calc(100%-0.5rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-lg border border-slate-600 bg-[#2c3140] shadow-2xl">
                                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                                  <h3 className="text-lg font-semibold text-white">New Event</h3>
                                  <div className="flex items-center gap-3 text-slate-300">
                                    <button type="button" className="transition hover:text-white">
                                      <Maximize2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      className="transition hover:text-white"
                                      onClick={() => setMeetingSlotDraft(null)}
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-3 overflow-y-auto px-4 py-3">
                                  <div className="flex items-center gap-3 text-sm text-white">
                                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="border-b border-cyan-400 pb-1">{scheduleDialogProject.name}</span>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-100 sm:text-sm">
                                    <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                                      <PopoverTrigger asChild>
                                        <button
                                          suppressHydrationWarning
                                          type="button"
                                          className="flex items-center gap-3 text-left transition hover:text-white"
                                        >
                                          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                          <span className="border-b border-cyan-500 pb-0.5">
                                            {getEventDateTimeLabel().date} {getEventDateTimeLabel().start}
                                          </span>
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent
                                        align="start"
                                        sideOffset={10}
                                        className="w-[380px] border-slate-600 bg-[#444756] p-0 text-slate-100"
                                      >
                                        <div className="p-4">
                                          <Calendar
                                            mode="single"
                                            selected={meetingDate}
                                            onSelect={(date) => date && setMeetingDate(date)}
                                            className="bg-transparent p-0 text-slate-100"
                                            classNames={{
                                              month_caption: "flex items-center justify-center h-8 px-8 text-sm text-slate-100",
                                              weekday: "text-slate-300 rounded-md flex-1 font-medium text-[0.8rem]",
                                              day: "text-slate-200",
                                              today: "bg-slate-700 text-white rounded-md",
                                              outside: "text-slate-500",
                                            }}
                                          />
                                          <div className="mt-4 flex items-center gap-3 border-t border-slate-600 pt-4">
                                            <Input
                                              type="time"
                                              value={meetingTime}
                                              onChange={(event) => setMeetingTime(event.target.value)}
                                              className="h-10 border-0 border-b border-slate-500 rounded-none bg-transparent px-0 text-slate-100"
                                            />
                                            <span className="text-slate-300">to</span>
                                            <Input
                                              type="time"
                                              value={meetingEndTime}
                                              onChange={(event) => setMeetingEndTime(event.target.value)}
                                              className="h-10 border-0 border-b border-slate-500 rounded-none bg-transparent px-0 text-slate-100"
                                            />
                                            <Button
                                              type="button"
                                              className="h-10 bg-[#8b4f83] px-4 text-sm text-white hover:bg-[#9a5b91]"
                                              onClick={() => setTimePickerOpen(false)}
                                            >
                                              Apply
                                            </Button>
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                    <span className="text-slate-400">to</span>
                                    <span>{getEventDateTimeLabel().end}</span>
                                    <label className="ml-auto flex items-center gap-2 text-slate-200">
                                      <input type="checkbox" className="h-3.5 w-3.5 accent-cyan-500" />
                                      All day
                                    </label>
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-slate-100 sm:text-sm">
                                    <UserRound className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="inline-flex items-center gap-2 rounded-full bg-[#5a5267] px-3 py-1.5 text-xs font-medium text-rose-200 sm:text-sm">
                                      {assignedName}
                                      <X className="h-3 w-3" />
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-3 text-xs sm:text-sm">
                                    <div className="flex items-center gap-3 text-slate-400">
                                      <MapPin className="h-3.5 w-3.5" />
                                      <span>Room or Location</span>
                                    </div>
                                    <button type="button" className="font-semibold text-cyan-400 transition hover:text-cyan-300">
                                      + Video conference
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-3 border-b border-slate-700 pb-3 text-xs text-slate-300 sm:text-sm">
                                    <Lock className="h-3.5 w-3.5 text-slate-400" />
                                    <span className="flex-1">Public</span>
                                    <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
                                  </div>

                                  <div className="flex items-center gap-3 text-xs text-white sm:text-sm">
                                    <span className="h-3.5 w-3.5 rounded-full bg-slate-400" />
                                    <Select
                                      value={meetingAvailability}
                                      onValueChange={(value) => setMeetingAvailability(value as "available" | "busy")}
                                    >
                                      <SelectTrigger
                                        size="sm"
                                        className="h-8 min-w-[140px] border-0 border-b border-slate-600 rounded-none bg-transparent px-0 text-left text-xs text-white shadow-none focus-visible:ring-0 sm:text-sm"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent
                                        align="start"
                                        className="min-w-[140px] border-slate-600 bg-[#444756] text-slate-100"
                                      >
                                        <SelectItem value="available" className="text-sm text-slate-100 focus:bg-[#555968] focus:text-white">
                                          Available
                                        </SelectItem>
                                        <SelectItem value="busy" className="text-sm text-slate-100 focus:bg-[#555968] focus:text-white">
                                          Busy
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="border-b border-slate-700 pb-2">
                                    <Textarea
                                      value={activityNote}
                                      onChange={(event) => setActivityNote(event.target.value)}
                                      placeholder="Notes"
                                      rows={4}
                                      className="min-h-[64px] resize-none border-0 bg-transparent px-0 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-between px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Button type="button" className="h-8 bg-[#8b4f83] px-3 text-xs text-white hover:bg-[#9a5b91] sm:text-sm">
                                      Save
                                    </Button>
                                    <Button type="button" variant="secondary" className="h-8 bg-[#454958] px-3 text-xs text-slate-100 hover:bg-[#54596a] sm:text-sm">
                                      More Options
                                    </Button>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    className="h-8 bg-[#454958] px-3 text-xs text-slate-100 hover:bg-[#54596a] sm:text-sm"
                                    onClick={() => setMeetingSlotDraft(null)}
                                  >
                                    Discard
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-col bg-[#252934]">
                          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                            <div className="flex items-center gap-4 text-slate-300">
                              <ChevronLeft className="h-4 w-4" />
                              <ChevronRight className="h-4 w-4" />
                            </div>
                            <p className="text-xl font-semibold text-slate-300">{format(meetingViewDate, "MMM yyyy")}</p>
                            <p className="text-base text-slate-300">[]</p>
                          </div>

                          <div className="px-4 py-3">
                            <div className="mb-3 grid grid-cols-7 text-center text-sm font-semibold text-slate-200">
                              {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
                                <span key={`${label}-${index}`}>{label}</span>
                              ))}
                            </div>
                            <div className="grid grid-cols-7 gap-y-2 text-center text-sm">
                              {miniMonthDays.map((day) => {
                                const inMonth = isSameMonth(day, meetingViewDate);
                                const selected = isSameDay(day, meetingViewDate);
                                return (
                                  <button
                                    key={day.toISOString()}
                                    type="button"
                                    onClick={() => {
                                      setMeetingViewDate(day);
                                      setMeetingDate(day);
                                    }}
                                    className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full transition ${
                                      selected
                                        ? "bg-red-600 text-white ring-4 ring-cyan-600/60"
                                        : inMonth
                                          ? "text-white hover:bg-[#454958]"
                                          : "text-slate-500 hover:bg-[#3a3f4d]"
                                    }`}
                                  >
                                    {format(day, "d")}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-auto border-t border-slate-700 px-4 py-4">
                            <div className="flex items-center justify-between text-xl font-semibold text-white">
                              <span>Attendees</span>
                              <ChevronRight className="h-4 w-4 rotate-90 text-slate-300" />
                            </div>
                            <div className="mt-3 flex items-center gap-3">
                              <input type="checkbox" checked readOnly className="h-4 w-4 accent-cyan-500" />
                              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#7d8294] text-sm font-semibold text-white">
                                {getInitials(assignedName)}
                              </span>
                              <span className="text-lg text-slate-100">{assignedName}</span>
                            </div>
                            <button
                              type="button"
                              className="mt-4 text-base text-slate-400 transition hover:text-slate-200"
                            >
                              + Add Attendees
                            </button>
                            <div className="mt-4 border-t border-slate-700 pt-4">
                              <label className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400" htmlFor="meeting-time">
                                Time
                              </label>
                              <Input
                                id="meeting-time"
                                type="time"
                                value={meetingTime}
                                onChange={(event) => setMeetingTime(event.target.value)}
                                className="mt-2 h-10 border-slate-600 bg-[#2d3342] text-sm text-slate-100"
                              />
                              <Textarea
                                value={activityNote}
                                onChange={(event) => setActivityNote(event.target.value)}
                                placeholder="Add meeting notes..."
                                rows={4}
                                className="mt-3 min-h-[96px] resize-none border-slate-600 bg-[#2d3342] text-sm text-slate-100 placeholder:text-slate-500"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[280px] flex-col items-center justify-center gap-6 py-10 text-center">
                      <CalendarDays className="h-40 w-40 text-slate-300" strokeWidth={1.4} />
                      <p className="text-xl text-slate-500">Schedule a meeting in your calendar</p>
                    </div>
                  )
                ) : selectedActivityType === "Request Signature" ? (
                  <div className="-mx-5 -mb-5 -mt-1 border-t border-slate-200 bg-white">
                    <div className="grid items-center gap-4 px-5 py-5 md:grid-cols-[auto_1fr_auto_220px]">
                      <span className="text-base font-semibold text-slate-900">Template</span>
                      <button
                        type="button"
                        className="text-left text-base text-slate-500 transition hover:text-slate-700"
                      >
                        Choose a template
                      </button>
                      <span className="text-center text-base font-semibold text-slate-900">or</span>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 w-full max-w-[220px] justify-center border border-slate-200 bg-slate-100 px-4 text-base font-semibold text-slate-900 hover:bg-slate-200"
                        onClick={handleSignatureUploadClick}
                      >
                        Upload PDF
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="border-b border-cyan-500/60 pb-2">
                      <div className="flex items-center gap-6 text-[2rem] leading-none">
                        <span className="font-semibold text-slate-900">Summary</span>
                        <span className="font-medium text-slate-500">{selectedActivityType}</span>
                      </div>
                    </div>

                    <div className="grid gap-8 md:grid-cols-[auto_1fr]">
                      <div className="space-y-6">
                        <div className="flex items-center gap-8">
                          <span className="min-w-24 text-xl font-semibold text-slate-900">Due Date</span>
                          <Popover open={activityDueDateOpen} onOpenChange={setActivityDueDateOpen}>
                            <PopoverTrigger asChild>
                              <button
                                suppressHydrationWarning
                                type="button"
                                className="text-xl text-slate-700 transition hover:text-slate-900"
                              >
                                {activityDueDate ? format(activityDueDate, "d MMM yyyy") : "No due date"}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              sideOffset={10}
                              className="w-[320px] border-slate-200 bg-white p-4 text-slate-900 shadow-lg"
                            >
                              <Calendar
                                mode="single"
                                selected={activityDueDate}
                                onSelect={(date) => {
                                  setActivityDueDate(date);
                                  setActivityDueDateOpen(false);
                                }}
                                className="bg-transparent p-0 text-slate-900"
                                classNames={{
                                  month_caption: "flex items-center justify-center h-8 px-8 text-sm text-slate-900",
                                  weekday: "text-slate-500 rounded-md flex-1 font-medium text-[0.8rem]",
                                  day: "text-slate-700",
                                  today: "bg-slate-900 text-white rounded-md",
                                  outside: "text-slate-300",
                                }}
                              />
                              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  onClick={() => {
                                    setActivityDueDate(undefined);
                                    setActivityDueDateOpen(false);
                                  }}
                                >
                                  Clear
                                </Button>
                                <Button
                                  type="button"
                                  className="bg-slate-900 text-white hover:bg-slate-800"
                                  onClick={() => setActivityDueDateOpen(false)}
                                >
                                  Apply
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-center gap-8">
                          <span className="min-w-24 text-xl font-semibold text-slate-900">Assigned to</span>
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-200 text-sm font-semibold text-slate-700">
                              {getInitials(getAssignedName(scheduleDialogProject))}
                            </span>
                            <span className="text-xl text-slate-700">{getAssignedName(scheduleDialogProject)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={activityNote}
                      onChange={(event) => setActivityNote(event.target.value)}
                      placeholder="Log a note..."
                      rows={6}
                      className="min-h-[160px] resize-none border-0 bg-transparent px-1 text-lg text-slate-700 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5">
                {selectedActivityType === "Request Signature" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    onClick={() => handleScheduleDialogClose(false)}
                  >
                    Discard
                  </Button>
                ) : null}
                {selectedActivityType === "Meeting" && !showMeetingCalendar ? (
                  <Button
                    type="button"
                    className="bg-slate-900 text-white hover:bg-slate-800"
                    onClick={handleScheduleMeeting}
                  >
                    Schedule
                  </Button>
                ) : null}
                {selectedActivityType !== "Request Signature" ? (
                  <>
                    <Button
                      type="button"
                      className="bg-slate-900 text-white hover:bg-slate-800"
                      onClick={handleSaveActivity}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      onClick={handleMarkDoneActivity}
                    >
                      Mark Done
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      onClick={() => handleScheduleDialogClose(false)}
                    >
                      Discard
                    </Button>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedLeadProfile}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLeadProfile(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl overflow-hidden border border-slate-200 bg-white p-0 text-slate-900 shadow-[0_24px_70px_-24px_rgba(15,23,42,0.32)]">
          {selectedLeadProfile ? (
            <>
              <div className="border-b border-slate-200 bg-gradient-to-r from-amber-50 via-white to-white px-6 py-5">
                <DialogHeader className="text-left">
                  <div className="flex items-start gap-4">
                    <div className="relative shrink-0">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-[#c89212] text-[3rem] font-medium text-white">
                        {getAvatarLetter(selectedLeadProfile.person.name)}
                      </div>
                      <span
                        className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white ${
                          selectedLeadProfile.person.isActive === false ? "bg-slate-300" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="truncate text-2xl font-semibold text-slate-900">
                        {selectedLeadProfile.person.name}
                      </DialogTitle>
                      <p className="mt-1 text-sm text-slate-500">
                        {getRoleLabel(selectedLeadProfile.person.role)} for {selectedLeadProfile.projectName}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-cyan-500" />
                          {selectedLeadProfile.person.email || "No email address"}
                        </span>
                        <span className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-slate-400" />
                          {selectedLeadProfile.person.phone || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {getRoleLabel(selectedLeadProfile.person.role)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.person.isActive === false ? "Inactive" : "Active"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Department</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.person.department || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Position</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.person.position || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Project</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.projectName}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{selectedLeadProfile.projectCode}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tasks</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.taskCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Hire Date</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">
                    {selectedLeadProfile.person.hireDate
                      ? format(new Date(selectedLeadProfile.person.hireDate), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                {selectedLeadProfile.person.email ? (
                  <Button
                    asChild
                    type="button"
                    className="h-10 rounded-md bg-[#44a2de] px-4 text-sm font-semibold text-white hover:bg-[#3991ca]"
                  >
                    <a href={`mailto:${selectedLeadProfile.person.email}`}>Send message</a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  onClick={() => setSelectedLeadProfile(null)}
                >
                  Close
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteStageTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteStageTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will delete stage &quot;{deleteStageTarget?.name}&quot; and move its projects.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteStage}
              className="bg-red-600 hover:bg-red-700"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
