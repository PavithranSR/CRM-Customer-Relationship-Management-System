"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { Role } from "@prisma/client";
import { Star } from "lucide-react";
import { getProjectTasks, type ProjectTaskStage } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskPriorityLabel,
  getTaskPriorityLevel,
  getTaskStatus,
  normalizeTask,
} from "@/lib/project-task-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssignmentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface BaProjectTasksProps {
  projectId: string;
  projectName: string;
  assignments: AssignmentUser[];
}

export function BaProjectTasks({ projectId, projectName, assignments }: BaProjectTasksProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<ProjectTaskStage[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("kanban");

  const assignmentMap = useMemo(
    () => new Map(assignments.map((assignee) => [assignee.id, assignee])),
    [assignments]
  );

  const loadTasks = useCallback(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        setTasks([]);
        return;
      }

      const normalized = result.data
        .map(normalizeTask)
        .filter((task): task is ProjectTask => Boolean(task));
      setTasks(normalized);
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
    });
  }, [projectId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const groupedTasksByStage = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of tasks) {
      const fallbackStageId = stages[0]?.id;
      const stageId = task.stageId && initial[task.stageId] ? task.stageId : fallbackStageId;
      if (!stageId) continue;
      initial[stageId].push(task);
    }

    return initial;
  }, [tasks, stages]);
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );
  const getStageName = useCallback(
    (task: ProjectTask) => stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do",
    [stages]
  );
  const getAssignedTlName = useCallback(
    (task: ProjectTask) => assignmentMap.get(task.assigneeId)?.name ?? "Unknown TL",
    [assignmentMap]
  );
  const getAssignedEmployeeName = useCallback(
    (task: ProjectTask) =>
      task.employeeAssigneeId
        ? assignmentMap.get(task.employeeAssigneeId)?.name ?? "Unknown employee"
        : "Not assigned by TL",
    [assignmentMap]
  );
  const getTaskAssigneeDisplay = useCallback(
    (task: ProjectTask) => {
      const userId = task.employeeAssigneeId || task.assigneeId;
      if (!userId) {
        return { name: "Unassigned", role: "UNASSIGNED" as const };
      }
      const assignee = assignmentMap.get(userId);
      if (!assignee) {
        return { name: "Unknown assignee", role: "UNKNOWN" as const };
      }
      return { name: assignee.name, role: assignee.role };
    },
    [assignmentMap]
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "kanban")}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks created yet.</p>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 text-left">
                      <th className="px-4 py-3 font-medium">Task Name</th>
                      <th className="px-4 py-3 font-medium">Assigned To</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const assigneeDisplay = getTaskAssigneeDisplay(task);
                      return (
                        <tr key={task.id} className="border-t align-top">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="font-medium text-left hover:underline"
                              onClick={() => setSelectedTaskId(task.id)}
                            >
                              {task.title}
                            </button>
                            <div className="mt-1 flex items-center gap-1 text-amber-500">
                              {Array.from({ length: getTaskPriorityLevel(task) }).map((_, index) => (
                                <Star key={`${task.id}-priority-${index}`} className="h-4 w-4 fill-current" />
                              ))}
                              <span className="ml-1 text-xs font-medium text-slate-600">
                                {getTaskPriorityLabel(task)}
                              </span>
                            </div>
                            {task.description ? (
                              <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{assigneeDisplay.name}</Badge>
                              <Badge variant="secondary">{assigneeDisplay.role}</Badge>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{getTaskStatus(task)}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="kanban" className="mt-4">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks created yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex min-w-[900px] items-start gap-4">
                  {stages.map((stage) => (
                    <div key={stage.id} className="w-80 shrink-0 rounded-lg border bg-muted/20 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-semibold">{stage.name}</p>
                        <Badge variant="outline">{groupedTasksByStage[stage.id]?.length ?? 0}</Badge>
                      </div>

                      <div className="space-y-3">
                        {(groupedTasksByStage[stage.id] ?? []).length === 0 ? (
                          <div className="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                            No tasks
                          </div>
                        ) : (
                          groupedTasksByStage[stage.id].map((task) => {
                            const assigneeDisplay = getTaskAssigneeDisplay(task);
                            return (
                              <div key={task.id} className="rounded-md border bg-background p-3 space-y-2">
                                <button
                                  type="button"
                                  className="font-medium text-left hover:underline"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  {task.title}
                                </button>
                                <div className="flex items-center gap-1 text-amber-500">
                                  {Array.from({ length: getTaskPriorityLevel(task) }).map((_, index) => (
                                    <Star key={`${task.id}-priority-${index}`} className="h-4 w-4 fill-current" />
                                  ))}
                                  <span className="ml-1 text-xs font-medium text-slate-600">
                                    {getTaskPriorityLabel(task)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline">{assigneeDisplay.name}</Badge>
                                  <Badge variant="secondary">{assigneeDisplay.role}</Badge>
                                  <Badge variant="secondary">{getTaskStatus(task)}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Due: {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                                </p>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Task Name</p>
                  <p className="font-semibold">{selectedTask.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Project Name</p>
                  <p className="font-medium">{projectName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned TL</p>
                  <p className="font-medium">{getAssignedTlName(selectedTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TL Assigned Employee</p>
                  <p className="font-medium">{getAssignedEmployeeName(selectedTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Task Stage</p>
                  <p className="font-medium">{getStageName(selectedTask)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Task Completion Percentage</p>
                  <p className="font-medium">{getTaskCompletionPercent(selectedTask)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Task Status</p>
                  <Badge variant="secondary">{getTaskStatus(selectedTask)}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Due Date</p>
                  <p className="font-medium">
                    {selectedTask.dueDate
                      ? format(new Date(selectedTask.dueDate), "MMM d, yyyy")
                      : "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 text-sm">{selectedTask.description || "-"}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
