"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Role } from "@prisma/client";
import {
  createProjectTask,
  createProjectTaskStage,
  deleteProjectTask,
  deleteProjectTaskStage,
  getProjectTasks,
  ProjectTaskStage,
  renameProjectTaskStage,
  updateProjectTask,
} from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TaskComments } from "@/components/projects/task-comments";
import {
  AlignLeft,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  GripVertical,
  MoreVertical,
  Pencil,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskPriorityLabel,
  getTaskPriorityLevel,
  normalizeTask,
} from "@/lib/project-task-utils";

interface AssignmentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department?: string | null;
  position?: string | null;
}

interface TlProjectKanbanProps {
  projectId: string;
  assignments: { user: AssignmentUser }[];
  canCreate?: boolean;
  canUpdate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

const STAGE_THEMES = [
  "bg-cyan-50 border-cyan-200",
  "bg-blue-50 border-blue-200",
  "bg-amber-50 border-amber-200",
  "bg-emerald-50 border-emerald-200",
  "bg-rose-50 border-rose-200",
  "bg-violet-50 border-violet-200",
] as const;

export function TlProjectKanban({
  projectId,
  assignments,
  canCreate = false,
  canUpdate = false,
  canEdit = false,
  canDelete = false,
}: TlProjectKanbanProps) {
  const MIN_STAGE_WIDTH = 260;
  const MAX_STAGE_WIDTH = 700;
  const DEFAULT_STAGE_WIDTH = 320;
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<ProjectTaskStage[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("1");
  const [stageId, setStageId] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [stageWidths, setStageWidths] = useState<Record<string, number>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [showAddStageInput, setShowAddStageInput] = useState(false);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const employees = useMemo(
    () =>
      assignments
        .map((assignment) => assignment.user)
        .filter((user) => user.role === "EMPLOYEE"),
    [assignments]
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const loadState = useCallback(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const nextStages = (result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      const nextTasks = result.data.map(normalizeTask).filter((item): item is ProjectTask => Boolean(item));
      setStages(nextStages);
      setTasks(nextTasks);
      if (!stageId && nextStages[0]) {
        setStageId(nextStages[0].id);
      }
    });
  }, [projectId, stageId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setAssigneeId("");
    setDueDate("");
    setPriority("1");
    setStageId(stages[0]?.id ?? "");
    setEditingTaskId(null);
    setShowTaskForm(false);
  };

  const upsertTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }
    if (!assigneeId) {
      toast.error("Assignee is required");
      return;
    }
    if (!stageId) {
      toast.error("Stage is required");
      return;
    }
    if (!employeeMap.has(assigneeId)) {
      toast.error("Assignee must be a project employee");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("title", trimmedTitle);
    formData.append("description", description.trim());
    formData.append("assigneeId", assigneeId);
    formData.append("stageId", stageId);
    formData.append("priority", priority);
    if (dueDate) {
      formData.append("dueDate", dueDate);
    }

    if (editingTaskId) {
      formData.append("taskId", editingTaskId);
      updateProjectTask(formData).then((result) => {
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
        if (result.stages) {
          setStages(result.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder));
        }
        resetForm();
        toast.success("Task updated");
      });
      return;
    }

    createProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      if (result.stages) {
        setStages(result.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      }
      resetForm();
      toast.success("Task created");
    });
  };

  const startEdit = (task: ProjectTask) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description);
    setAssigneeId(task.assigneeId);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setPriority(String(getTaskPriorityLevel(task)));
    setStageId(task.stageId ?? stages[0]?.id ?? "");
    setShowTaskForm(true);
  };

  const removeTask = (taskId: string) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);

    deleteProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      if (result.stages) {
        setStages(result.stages.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      }
      if (editingTaskId === taskId) resetForm();
      toast.success("Task removed");
    });
  };

  const confirmDeleteTask = () => {
    if (!deleteTaskId) {
      return;
    }

    removeTask(deleteTaskId);
    setDeleteTaskId(null);
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

    createProjectTaskStage(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const nextStages = (result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      setStages(nextStages);
      setNewStageName("");
      if (!stageId && nextStages[0]) setStageId(nextStages[0].id);
      toast.success("Stage added");
    });
  };

  const removeStage = (id: string) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("stageId", id);

    deleteProjectTaskStage(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const nextStages = (result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      setStages(nextStages);
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      if (editingStageId === id) {
        setEditingStageId(null);
        setEditingStageName("");
      }
      if (stageId === id) {
        setStageId(nextStages[0]?.id ?? "");
      }
      toast.success("Stage deleted");
    });
  };

  const startEditStage = (stage: ProjectTaskStage) => {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  };

  const cancelEditStage = () => {
    setEditingStageId(null);
    setEditingStageName("");
  };

  const saveStageName = () => {
    if (!editingStageId) return;
    const name = editingStageName.trim();
    if (!name) {
      toast.error("Stage name is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("stageId", editingStageId);
    formData.append("name", name);

    renameProjectTaskStage(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      toast.success("Stage updated");
      cancelEditStage();
    });
  };

  const startResizeStage = (targetStageId: string, startX: number) => {
    const initialWidth = stageWidths[targetStageId] ?? DEFAULT_STAGE_WIDTH;

    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.max(
        MIN_STAGE_WIDTH,
        Math.min(MAX_STAGE_WIDTH, initialWidth + (event.clientX - startX))
      );
      setStageWidths((prev) => ({ ...prev, [targetStageId]: nextWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const moveTaskToStage = (task: ProjectTask, targetStageId: string) => {
    if (!canUpdate) {
      return;
    }
    if (!targetStageId || task.stageId === targetStageId) {
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);
    formData.append("title", task.title);
    formData.append("description", task.description ?? "");
    formData.append("assigneeId", task.assigneeId);
    formData.append("stageId", targetStageId);
    formData.append("priority", String(getTaskPriorityLevel(task)));
    if (task.dueDate) {
      formData.append("dueDate", task.dueDate);
    }

    updateProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      toast.success("Task moved");
    });
  };

  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }
    for (const task of tasks) {
      const assignedStageId = task.stageId && initial[task.stageId] ? task.stageId : stages[0]?.id;
      if (!assignedStageId) continue;
      initial[assignedStageId].push(task);
    }
    return initial;
  }, [tasks, stages]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );
  const orderedStages = useMemo(
    () => stages.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [stages]
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-2">
        {canCreate && (
          <Button
            type="button"
            onClick={() => {
              setShowTaskForm((current) => !current);
              setShowAddStageInput(false);
            }}
          >
            {showTaskForm ? "Close Task Form" : editingTaskId ? "Edit Task" : "Add Task"}
          </Button>
        )}
      </div>

      <Dialog
        open={(canCreate || (canUpdate && editingTaskId !== null)) && showTaskForm}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            return;
          }
          setShowTaskForm(true);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit Task" : "Add Task"}</DialogTitle>
            <DialogDescription>
              Fill task details and assign it to a team employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border bg-white p-3">
            <div className="relative">
              <BriefcaseBusiness className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <Input
                id="task-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Task name"
                className="h-11 border-0 border-b rounded-none pl-10 shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-deadline">Deadline</Label>
              <Input
                id="task-deadline"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Star = Medium</SelectItem>
                  <SelectItem value="2">2 Stars = High</SelectItem>
                  <SelectItem value="3">3 Stars = Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <AlignLeft className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-600" />
              <Textarea
                id="task-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
                rows={3}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={upsertTask}>
                {editingTaskId ? "Update" : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="border-slate-200 p-0 sm:max-w-3xl">
          {selectedTask ? (
            <>
              <DialogHeader className="border-b border-slate-100 bg-gradient-to-r from-white via-slate-50 to-slate-100 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-xl font-semibold tracking-tight">
                      {selectedTask.title}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      Full task details, activity logs, and comments.
                    </DialogDescription>
                  </div>
                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                    {getTaskCompletionPercent(selectedTask)}% Complete
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-5 px-6 py-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                  <p className="text-sm text-slate-700">
                    {selectedTask.description?.trim() || "No description provided."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assignee</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {selectedTask.assigneeId ? employeeMap.get(selectedTask.assigneeId)?.name || "Unknown" : "Unassigned"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Department</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {employeeMap.get(selectedTask.assigneeId)?.department || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Position</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {employeeMap.get(selectedTask.assigneeId)?.position || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-800">Task Activity Log</p>
                  {selectedTask.updates.length === 0 ? (
                    <p className="text-sm text-slate-500">No activity yet.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedTask.updates
                        .slice()
                        .reverse()
                        .map((update) => (
                          <div key={update.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-700">Update added</p>
                              <p className="text-[11px] text-slate-500">
                                {format(new Date(update.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{update.comment || "No comment"}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <TaskComments projectId={projectId} taskId={selectedTask.id} onChange={loadState} />
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTaskId)} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the selected task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTask} className="bg-red-600 hover:bg-red-700">
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="overflow-x-auto">
        <div className="relative flex min-w-[960px] items-stretch gap-4 overflow-y-auto pb-2">
          {orderedStages.map((column, columnIndex) => {
            const stageTasks = groupedTasks[column.id] ?? [];
            const themeClass = STAGE_THEMES[columnIndex % STAGE_THEMES.length];

            return (
            <div
              key={column.id}
              style={{ width: stageWidths[column.id] ?? DEFAULT_STAGE_WIDTH }}
              className="flex min-h-full min-w-[260px] shrink-0 self-stretch flex-col"
            >
              <div className={`sticky top-0 z-20 flex items-center justify-between gap-2 border px-3 py-2 ${themeClass}`}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {editingStageId === column.id ? (
                    <Input
                      value={editingStageName}
                      onChange={(event) => setEditingStageName(event.target.value)}
                      className="h-8 min-w-0 w-full max-w-[10rem] bg-white"
                      autoFocus
                    />
                  ) : (
                    <h3 className="truncate text-2xl font-semibold tracking-tight text-slate-950">{column.name}</h3>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="h-7 min-w-7 rounded-full bg-slate-200 px-2 text-sm font-semibold text-slate-700"
                  >
                    {stageTasks.length}
                  </Badge>
                  {canEdit && editingStageId === column.id ? (
                    <>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={saveStageName}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditStage}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : canEdit ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => startEditStage(column)}
                    >
                        <Pencil className="h-4 w-4" />
                      </Button>
                  ) : null}
                  {canDelete && stages.length > 1 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-600 hover:text-red-700"
                      onClick={() => removeStage(column.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 cursor-col-resize"
                    aria-label={`Resize ${column.name} stage`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      startResizeStage(column.id, event.clientX);
                    }}
                  >
                    <GripVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div
                className={`flex min-h-0 flex-1 flex-col transition-colors ${
                  dragOverStageId === column.id ? "bg-muted/35" : ""
                }`}
                onDragOver={(event) => {
                  if (!canUpdate) return;
                  event.preventDefault();
                  setDragOverStageId(column.id);
                }}
                onDragLeave={() => {
                  setDragOverStageId((current) => (current === column.id ? null : current));
                }}
                onDrop={(event) => {
                  if (!canUpdate) return;
                  event.preventDefault();
                  const droppedTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
                  if (!droppedTaskId) return;
                  const task = tasks.find((item) => item.id === droppedTaskId);
                  if (!task) return;
                  moveTaskToStage(task, column.id);
                  setDraggingTaskId(null);
                  setDragOverStageId(null);
                }}
              >
              {stageTasks.length === 0 ? (
                <div className="flex flex-1 items-center justify-center border border-dashed border-slate-300 p-4 text-center text-sm text-muted-foreground">
                  No tasks in this stage
                </div>
              ) : (
                stageTasks.map((task) => (
                  <Card
                    key={task.id}
                    className="gap-0 rounded-none border-x border-b border-t-0 border-slate-400 py-0 shadow-none first:border-t"
                    draggable={canUpdate}
                    onDragStart={(event) => {
                      if (!canUpdate) return;
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggingTaskId(task.id);
                    }}
                    onDragEnd={() => {
                      setDraggingTaskId(null);
                      setDragOverStageId(null);
                    }}
                  >
                    <CardContent className="space-y-2 px-2.5 pb-2 pt-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 text-left"
                          onClick={() => setSelectedTaskId(task.id)}
                          aria-label={`Open details for ${task.title}`}
                        >
                          <p className="font-semibold leading-tight">{task.title}</p>
                        </button>
                        {(canEdit || canDelete) ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                aria-label="Task actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              {canEdit ? (
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    startEdit(task);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                              ) : null}
                              {canDelete ? (
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-700"
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    setDeleteTaskId(task.id);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                      {task.description ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
                      ) : null}
                      <div className="space-y-0.5 text-xs text-muted-foreground">
                        <p>Assignee: {task.assigneeId ? employeeMap.get(task.assigneeId)?.name || "Unknown" : "Unassigned"}</p>
                        <p>Progress: {getTaskCompletionPercent(task)}%</p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: getTaskPriorityLevel(task) }).map((_, index) => (
                          <Star key={`${task.id}-priority-${index}`} className="h-4 w-4 fill-current" />
                        ))}
                        <span className="ml-1 text-xs font-medium text-slate-600">
                          {getTaskPriorityLabel(task)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
              </div>
            </div>
          )})}
          {canCreate ? (
            <div className="sticky right-0 top-0 z-20 flex w-10 shrink-0 self-start items-start justify-center bg-white/95">
              {showAddStageInput ? (
                <div className="absolute left-full top-0 w-[250px] border border-slate-300 bg-slate-100 shadow-sm">
                  <div className="border-b border-slate-300 bg-slate-100 p-2.5">
                    <p className="text-lg font-semibold tracking-tight text-slate-900">New Stage</p>
                    <p className="mt-1 text-xs text-slate-500">Create a new task stage</p>
                  </div>
                  <div className="space-y-2 p-2">
                    <Input
                      value={newStageName}
                      onChange={(event) => setNewStageName(event.target.value)}
                      placeholder="Stage name..."
                      className="h-9 bg-white"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          addStage();
                          setShowAddStageInput(false);
                        }}
                        className="h-8 px-3"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddStageInput(false);
                          setNewStageName("");
                        }}
                        className="h-8 px-3"
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
                  onClick={() => {
                    setShowAddStageInput(true);
                    setShowTaskForm(false);
                  }}
                  className="group flex h-full min-h-[200px] w-10 flex-col items-center justify-start gap-2 rounded-none px-0 pt-1 text-slate-800 hover:bg-slate-100"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="[writing-mode:vertical-rl] rotate-180 text-base leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                    Add Stage
                  </span>
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
