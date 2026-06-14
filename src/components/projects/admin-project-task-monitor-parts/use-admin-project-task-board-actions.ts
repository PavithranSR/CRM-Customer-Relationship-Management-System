"use client";

import { startTransition, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { toast } from "sonner";
import {
  createProjectTask,
  createProjectTaskStageByAdmin,
  deleteProjectTask,
  deleteProjectTaskStageByAdmin,
  renameProjectTaskStage,
  updateProjectTask,
} from "@/actions/project-task.actions";
import {
  findEmployeeByQuery,
  getEmployeeOptionLabel,
  type TaskEmployeeProfileState,
  type TaskStageItem,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import { getTaskPriorityLevel, normalizeTask, type ProjectTask } from "@/lib/project-task-utils";

interface UseAdminProjectTaskBoardActionsProps {
  employeeAssignments: TeamPerson[];
  projectAssignableIds: Set<string>;
  projectId: string;
  setStages: Dispatch<SetStateAction<TaskStageItem[]>>;
  setTasks: Dispatch<SetStateAction<ProjectTask[]>>;
  stages: TaskStageItem[];
  tasks: ProjectTask[];
}

export function useAdminProjectTaskBoardActions({
  employeeAssignments,
  projectAssignableIds,
  projectId,
  setStages,
  setTasks,
  stages,
  tasks,
}: UseAdminProjectTaskBoardActionsProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showQuickAddTaskCard, setShowQuickAddTaskCard] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [, setTaskAssigneeId] = useState("");
  const [taskAssigneeQuery, setTaskAssigneeQuery] = useState("");
  const [taskStageId, setTaskStageId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState("1");
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isSavingStage, setIsSavingStage] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [deleteStageTarget, setDeleteStageTarget] = useState<TaskStageItem | null>(null);
  const [taskAssigneePopoverTaskId, setTaskAssigneePopoverTaskId] = useState<string | null>(null);
  const [selectedTaskEmployeeProfile, setSelectedTaskEmployeeProfile] = useState<TaskEmployeeProfileState | null>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const getProgressForStageId = (stageId: string | undefined) => {
    if (stages.length <= 1) {
      return 0;
    }

    const fallbackStageId = stages[0]?.id ?? "";
    const resolvedStageId = stageId && stages.some((stage) => stage.id === stageId) ? stageId : fallbackStageId;
    const stageIndex = Math.max(0, stages.findIndex((stage) => stage.id === resolvedStageId));

    return Math.max(0, Math.min(100, Math.round((stageIndex / (stages.length - 1)) * 100)));
  };

  const getStageLabelById = (stageId: string | null | undefined) =>
    stages.find((stage) => stage.id === stageId)?.name ?? "Unknown stage";

  const clearTaskComposerFields = () => {
    setEditingTaskId(null);
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssigneeId("");
    setTaskAssigneeQuery("");
    setTaskStageId(stages[0]?.id ?? "");
    setTaskDueDate("");
    setTaskPriority("1");
  };

  const updateTaskAssigneeQuery = (value: string) => {
    setTaskAssigneeQuery(value);
    const matchedEmployee = findEmployeeByQuery(employeeAssignments, value);
    setTaskAssigneeId(matchedEmployee?.id ?? "");
  };

  const selectTaskAssignee = (employee: TeamPerson) => {
    setTaskAssigneeId(employee.id);
    setTaskAssigneeQuery(getEmployeeOptionLabel(employee));
  };

  const applyTaskAssigneeById = (assigneeId: string) => {
    const matchedEmployee = employeeAssignments.find((employee) => employee.id === assigneeId) ?? null;
    setTaskAssigneeId(matchedEmployee?.id ?? "");
    setTaskAssigneeQuery(matchedEmployee ? getEmployeeOptionLabel(matchedEmployee) : "");
  };

  const clearTaskAssignee = () => {
    setTaskAssigneeId("");
    setTaskAssigneeQuery("");
  };

  const ensureTaskAssigneeIsProjectMember = async (assigneeId: string) => {
    if (!assigneeId || projectAssignableIds.has(assigneeId)) {
      return true;
    }

    toast.error("Only the assigned team leader and project team members can be selected");
    return false;
  };

  const addStage = () => {
    const name = newStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("name", name);
    setIsSavingStage(true);
    createProjectTaskStageByAdmin(formData).then((result) => {
      setIsSavingStage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      startTransition(() => {
        setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
        setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      });
      setNewStageName("");
      setShowAddStageInput(false);
      toast.success("Stage added");
    });
  };

  const startEditStage = (stageId: string, stageName: string) => {
    setEditingStageId(stageId);
    setEditingStageName(stageName);
  };

  const cancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveStageName = () => {
    if (!editingStageId) {
      return;
    }

    const name = editingStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("stageId", editingStageId);
    formData.append("name", name);

    setIsSavingStage(true);
    renameProjectTaskStage(formData).then((result) => {
      setIsSavingStage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      startTransition(() => {
        setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
        setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      });
      cancelEditStage();
      toast.success("Stage updated");
    });
  };

  const assignEmployeeToTask = async (task: ProjectTask, assigneeId: string) => {
    const normalizedAssigneeId = assigneeId === "unassigned" ? "" : assigneeId;
    setAssigningTaskId(task.id);

    const isReadyToAssign = normalizedAssigneeId
      ? await ensureTaskAssigneeIsProjectMember(normalizedAssigneeId)
      : true;
    if (!isReadyToAssign) {
      setAssigningTaskId(null);
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);
    formData.append("title", task.title);
    formData.append("description", task.description ?? "");
    formData.append("assigneeId", normalizedAssigneeId);
    formData.append("priority", String(getTaskPriorityLevel(task)));
    if (task.dueDate) formData.append("dueDate", task.dueDate.slice(0, 10));
    if (task.stageId) formData.append("stageId", task.stageId);

    const result = await updateProjectTask(formData);
    setAssigningTaskId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    startTransition(() => {
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
    });
    setTaskAssigneePopoverTaskId(null);
    toast.success(normalizedAssigneeId ? "Team member assigned to task" : "Task assignee cleared");
  };

  const moveTaskToStage = async (task: ProjectTask, targetStageId: string) => {
    const normalizedCurrentStageId = task.stageId || stages[0]?.id || "";
    if (!targetStageId || normalizedCurrentStageId === targetStageId) {
      return;
    }

    const previousTasks = tasks;
    setMovingTaskId(task.id);
    setTasks((current) =>
      current.map((item) =>
        item.id === task.id
          ? { ...item, stageId: targetStageId, progress: getProgressForStageId(targetStageId) }
          : item
      )
    );

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);
    formData.append("title", task.title);
    formData.append("description", task.description ?? "");
    formData.append("assigneeId", task.employeeAssigneeId || task.assigneeId || "");
    formData.append("priority", String(getTaskPriorityLevel(task)));
    formData.append("stageId", targetStageId);
    if (task.dueDate) formData.append("dueDate", task.dueDate.slice(0, 10));

    const result = await updateProjectTask(formData);
    setMovingTaskId(null);
    setDraggedTaskId(null);
    setDragOverStageId(null);

    if (result.error) {
      setTasks(previousTasks);
      toast.error(result.error);
      return;
    }

    startTransition(() => {
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
    });
    toast.success(`Task moved to ${getStageLabelById(targetStageId)}`);
  };

  const handleTaskDragStart = (task: ProjectTask, event: DragEvent<HTMLDivElement>) => {
    if (movingTaskId) {
      event.preventDefault();
      return;
    }

    setDraggedTaskId(task.id);
    setDragOverStageId(task.stageId || null);
    setTaskAssigneePopoverTaskId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStageId(null);
  };

  const handleStageDragOver = (stageId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleStageDrop = async (stageId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();

    const droppedTaskId = draggedTaskId || event.dataTransfer.getData("text/plain");
    setDragOverStageId(null);
    if (!droppedTaskId) {
      setDraggedTaskId(null);
      return;
    }

    const task = tasks.find((item) => item.id === droppedTaskId);
    if (!task) {
      setDraggedTaskId(null);
      return;
    }

    const currentStageId = task.stageId || stages[0]?.id || "";
    if (!stageId || currentStageId === stageId) {
      setDraggedTaskId(null);
      return;
    }

    await moveTaskToStage(task, stageId);
  };

  const openTaskEmployeeProfile = (task: ProjectTask, employee: TeamPerson) => {
    setTaskAssigneePopoverTaskId(null);
    setSelectedTaskEmployeeProfile({ employee, taskTitle: task.title });
  };

  const openQuickAddTaskCard = () => {
    clearTaskComposerFields();
    setShowAddTaskDialog(false);
    setShowQuickAddTaskCard(true);
  };

  const closeQuickAddTaskCard = () => {
    setShowQuickAddTaskCard(false);
    clearTaskComposerFields();
  };

  const openFullTaskDialogFromQuickCard = () => {
    setShowQuickAddTaskCard(false);
    setShowAddTaskDialog(true);
  };

  const addTask = async () => {
    const trimmedTitle = taskTitle.trim();
    const trimmedAssigneeQuery = taskAssigneeQuery.trim();
    const matchedAssignee = trimmedAssigneeQuery ? findEmployeeByQuery(employeeAssignments, trimmedAssigneeQuery) : null;

    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }
    if (trimmedAssigneeQuery && !matchedAssignee) {
      setTaskAssigneeId("");
      toast.error("Please select an employee from the list or leave it blank");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("title", trimmedTitle);
    formData.append("description", taskDescription.trim());
    if (matchedAssignee) formData.append("assigneeId", matchedAssignee.id);
    if (taskStageId) formData.append("stageId", taskStageId);
    formData.append("priority", taskPriority);
    if (editingTaskId) formData.append("taskId", editingTaskId);
    if (taskDueDate) formData.append("dueDate", taskDueDate);

    setIsSavingTask(true);
    const isReadyToAssign = matchedAssignee ? await ensureTaskAssigneeIsProjectMember(matchedAssignee.id) : true;
    if (!isReadyToAssign) {
      setIsSavingTask(false);
      return;
    }

    const result = editingTaskId ? await updateProjectTask(formData) : await createProjectTask(formData);
    setIsSavingTask(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    startTransition(() => {
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
    });
    clearTaskComposerFields();
    setShowQuickAddTaskCard(false);
    setShowAddTaskDialog(false);
    toast.success(editingTaskId ? "Task updated" : "Task created");
  };

  const startEditTask = (task: ProjectTask) => {
    setShowQuickAddTaskCard(false);
    setEditingTaskId(task.id);
    setTaskTitle(task.title);
    setTaskDescription(task.description ?? "");
    applyTaskAssigneeById(task.employeeAssigneeId || task.assigneeId);
    setTaskStageId(task.stageId || stages[0]?.id || "");
    setTaskDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setTaskPriority(String(getTaskPriorityLevel(task)));
    setShowAddTaskDialog(true);
  };

  const deleteTask = (task: ProjectTask) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);

    deleteProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      startTransition(() => {
        setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      });
      if (editingTaskId === task.id) {
        clearTaskComposerFields();
      }
      toast.success("Task deleted");
    });
  };

  const resetTaskDialog = () => {
    setShowQuickAddTaskCard(false);
    setShowAddTaskDialog(false);
    clearTaskComposerFields();
  };

  const deleteStage = (stageId: string) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("stageId", stageId);

    setIsSavingStage(true);
    deleteProjectTaskStageByAdmin(formData).then((result) => {
      setIsSavingStage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      startTransition(() => {
        setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
        setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      });
      toast.success("Stage deleted");
    });
  };

  return {
    addStage,
    addTask,
    assignEmployeeToTask,
    assigningTaskId,
    cancelEditStage,
    closeQuickAddTaskCard,
    deleteStage,
    deleteStageTarget,
    draggedTaskId,
    dragOverStageId,
    editingStageId,
    editingStageName,
    editingTaskId,
    handleStageDragOver,
    handleStageDrop,
    handleTaskDragEnd,
    handleTaskDragStart,
    isSavingStage,
    isSavingTask,
    movingTaskId,
    newStageName,
    openFullTaskDialogFromQuickCard,
    openQuickAddTaskCard,
    openTaskEmployeeProfile,
    resetTaskDialog,
    saveStageName,
    selectTaskAssignee,
    clearTaskAssignee,
    selectedTaskEmployeeProfile,
    deleteTask,
    setDeleteStageTarget,
    setEditingStageName,
    setNewStageName,
    setSelectedTaskEmployeeProfile,
    setShowAddStageInput,
    setShowAddTaskDialog,
    setTaskDescription,
    setTaskDueDate,
    setTaskPriority,
    setTaskStageId,
    setTaskTitle,
    setTaskAssigneePopoverTaskId,
    showAddStageInput,
    showAddTaskDialog,
    showQuickAddTaskCard,
    startEditStage,
    startEditTask,
    taskAssigneePopoverTaskId,
    taskAssigneeQuery,
    taskDescription,
    taskDueDate,
    taskPriority,
    taskStageId,
    taskTitle,
    updateTaskAssigneeQuery,
  };
}
