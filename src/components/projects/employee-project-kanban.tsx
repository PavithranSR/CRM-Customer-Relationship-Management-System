"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  getProjectTasks,
  moveOwnProjectTaskStage,
  reassignProjectTask,
} from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TaskComments } from "@/components/projects/task-comments";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskStatus,
  normalizeTask,
} from "@/lib/project-task-utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STAGE_THEMES = [
  "border-cyan-200 bg-cyan-50/60",
  "border-blue-200 bg-blue-50/60",
  "border-amber-200 bg-amber-50/60",
  "border-emerald-200 bg-emerald-50/60",
  "border-rose-200 bg-rose-50/60",
] as const;

interface EmployeeProjectKanbanProps {
  projectId: string;
  currentUserId: string;
  canMoveTasks?: boolean;
  showTaskDetailsModal?: boolean;
  projectEmployees?: { id: string; name: string; email: string }[];
}

export function EmployeeProjectKanban({
  projectId,
  currentUserId,
  canMoveTasks = true,
  showTaskDetailsModal = false,
  projectEmployees = [],
}: EmployeeProjectKanbanProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; sortOrder: number }[]>([]);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const loadState = useCallback(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        result.data.map(normalizeTask).filter((item): item is ProjectTask => Boolean(item))
      );
    });
  }, [projectId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const myTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.assigneeId === currentUserId ||
          task.employeeAssigneeId === currentUserId
      ),
    [tasks, currentUserId]
  );
  const selectedTask = useMemo(
    () => myTasks.find((task) => task.id === selectedTaskId) ?? null,
    [myTasks, selectedTaskId]
  );
  const employeeMap = useMemo(
    () => new Map(projectEmployees.map((employee) => [employee.id, employee])),
    [projectEmployees]
  );
  const getAssignedEmployeeId = useCallback(
    (task: ProjectTask) => {
      if (task.employeeAssigneeId && employeeMap.has(task.employeeAssigneeId)) {
        return task.employeeAssigneeId;
      }
      if (employeeMap.has(task.assigneeId)) {
        return task.assigneeId;
      }
      return "";
    },
    [employeeMap]
  );

  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }
    for (const task of myTasks) {
      const assignedStageId = task.stageId && initial[task.stageId] ? task.stageId : stages[0]?.id;
      if (!assignedStageId) continue;
      initial[assignedStageId].push(task);
    }
    return initial;
  }, [myTasks, stages]);
  const existingAssignedEmployeeId = useMemo(
    () => (selectedTask ? getAssignedEmployeeId(selectedTask) : ""),
    [getAssignedEmployeeId, selectedTask]
  );
  const isReassignMode = Boolean(existingAssignedEmployeeId);

  const moveTaskToStage = (taskId: string, targetStageId: string) => {
    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);
    formData.append("targetStageId", targetStageId);

    moveOwnProjectTaskStage(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      toast.success("Task moved");
    });
  };

  const handleReassign = () => {
    if (!selectedTask) return;
    if (!selectedEmployeeId) {
      toast.error("Select an employee");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", selectedTask.id);
    formData.append("employeeId", selectedEmployeeId);

    reassignProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isReassignMode ? "Task reassigned successfully" : "Task assigned to employee");
      setSelectedTaskId(null);
      setSelectedEmployeeId("");
      loadState();
    });
  };
  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "kanban" ? "default" : "outline"}
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>
          {myTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No assigned tasks yet.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {viewMode === "kanban" ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-[960px] items-start gap-5">
            {stages.map((column, columnIndex) => (
              <div
                key={column.id}
                className={`w-full min-w-[320px] transition-colors ${
                  dragOverStageId === column.id ? "opacity-90" : ""
                }`}
                onDragOver={(event) => {
                  if (!canMoveTasks) return;
                  event.preventDefault();
                  setDragOverStageId(column.id);
                }}
                onDragLeave={() =>
                  setDragOverStageId((current) => (current === column.id ? null : current))
                }
                onDrop={(event) => {
                  if (!canMoveTasks) return;
                  event.preventDefault();
                  const droppedTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
                  if (!droppedTaskId) return;
                  const task = myTasks.find((item) => item.id === droppedTaskId);
                  if (!task || task.stageId === column.id) return;
                  moveTaskToStage(droppedTaskId, column.id);
                  setDraggingTaskId(null);
                  setDragOverStageId(null);
                }}
              >
                <div className={`border ${STAGE_THEMES[columnIndex % STAGE_THEMES.length]}`}>
                  <div className="flex items-center justify-between border-b border-slate-300/80 px-4 py-3">
                    <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{column.name}</h3>
                    <Badge
                      variant="secondary"
                      className="h-7 min-w-7 rounded-full bg-slate-200 px-2 text-sm font-semibold text-slate-700"
                    >
                      {groupedTasks[column.id]?.length ?? 0}
                    </Badge>
                  </div>

                  {(groupedTasks[column.id]?.length ?? 0) === 0 ? (
                    <div className="border-t border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-slate-600">
                      No tasks
                    </div>
                  ) : (
                    <div className="bg-white">
                      {groupedTasks[column.id].map((task, taskIndex) => (
                        <div
                          key={task.id}
                          draggable={canMoveTasks}
                          onDragStart={(event) => {
                            if (!canMoveTasks) return;
                            event.dataTransfer.setData("text/plain", task.id);
                            event.dataTransfer.effectAllowed = "move";
                            setDraggingTaskId(task.id);
                          }}
                          onDragEnd={() => {
                            setDraggingTaskId(null);
                            setDragOverStageId(null);
                          }}
                          className={`${canMoveTasks ? "cursor-grab active:cursor-grabbing" : ""} ${
                            taskIndex < groupedTasks[column.id].length - 1 ? "border-b border-slate-300/90" : ""
                          } bg-white px-4 py-3 transition hover:bg-slate-50`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {showTaskDetailsModal ? (
                                <button
                                  type="button"
                                  className="truncate text-left text-sm font-semibold text-slate-900 hover:underline"
                                  onClick={() => {
                                    setSelectedTaskId(task.id);
                                    setSelectedEmployeeId(getAssignedEmployeeId(task));
                                  }}
                                >
                                  {task.title}
                                </button>
                              ) : (
                                <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                              )}
                              <p className="text-sm text-slate-600">{task.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <span className="shrink-0 text-sm font-medium text-slate-700">
                              {getTaskCompletionPercent(task)}%
                            </span>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-700">
                            <p>
                              Assigned TL: <span className="font-medium">mahel</span>
                            </p>
                            {showTaskDetailsModal ? (
                              <p>
                                Assigned Employee:{" "}
                                <span className="font-medium">
                                  {employeeMap.get(getAssignedEmployeeId(task))?.name ?? "Not assigned"}
                                </span>
                              </p>
                            ) : null}
                            <p>
                              Due Date:{" "}
                              <span className="font-medium">
                                {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                              </span>
                            </p>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full border-slate-300 bg-white text-slate-900">
                              {getTaskStatus(task)}
                            </Badge>
                            <Badge className="rounded-full bg-slate-900 text-white hover:bg-slate-900">
                              {getTaskCompletionPercent(task)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-4 py-3">Task Name</th>
                    <th className="px-4 py-3">TL</th>
                    <th className="px-4 py-3">Assigned Employee</th>
                    <th className="px-4 py-3">Due Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myTasks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No tasks
                      </td>
                    </tr>
                  ) : (
                    myTasks.map((task) => (
                      <tr key={task.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {showTaskDetailsModal ? (
                            <button
                              type="button"
                              className="text-left hover:underline"
                              onClick={() => {
                                setSelectedTaskId(task.id);
                                setSelectedEmployeeId(getAssignedEmployeeId(task));
                              }}
                            >
                              {task.title}
                            </button>
                          ) : (
                            task.title
                          )}
                        </td>
                        <td className="px-4 py-3">
                          You (Team Leader)
                        </td>
                        <td className="px-4 py-3">
                          {employeeMap.get(getAssignedEmployeeId(task))?.name ?? "Not assigned"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={showTaskDetailsModal && !!selectedTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
            setSelectedEmployeeId("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Task Name</p>
                <p className="font-semibold">{selectedTask.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p>{selectedTask.description || "-"}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <p className="font-medium">You (Team Leader)</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="secondary">{getTaskStatus(selectedTask)}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stage</p>
                  <p className="font-medium">
                    {stages.find((stage) => stage.id === selectedTask.stageId)?.name ?? "To Do"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Employee</p>
                  <p className="font-medium">
                    {employeeMap.get(getAssignedEmployeeId(selectedTask))?.name ?? "Not assigned"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completion</p>
                  <p className="font-medium">{getTaskCompletionPercent(selectedTask)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {selectedTask.dueDate
                      ? format(new Date(selectedTask.dueDate), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2 rounded-md border p-3">
                    <Label>{isReassignMode ? "Reassign Employee" : "Assign Employee"}</Label>
                    <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {projectEmployees.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No project employees available
                          </SelectItem>
                        ) : (
                          projectEmployees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name} ({employee.email})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedEmployeeId && (
                      <p className="text-xs text-muted-foreground">
                        Selected: {employeeMap.get(selectedEmployeeId)?.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium text-muted-foreground">Task Activity Log</p>
                    {selectedTask.updates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No activity yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedTask.updates
                          .slice()
                          .reverse()
                          .map((update) => (
                            <div key={update.id} className="rounded border p-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium">Update added</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {format(new Date(update.createdAt), "MMM d, h:mm a")}
                                </p>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {update.comment || "No comment"}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium text-muted-foreground">Task Comments</p>
                  <TaskComments projectId={projectId} taskId={selectedTask.id} onChange={loadState} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedTaskId(null);
                setSelectedEmployeeId("");
              }}
            >
              Close
            </Button>
            <Button type="button" onClick={handleReassign} disabled={!selectedEmployeeId}>
              {isReassignMode ? "Reassign Employee" : "Assign Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
