"use client";

import type { DragEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  addProjectTaskDailyUpdate,
  getProjectTasks,
  moveOwnProjectTaskStage,
} from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ProjectTask,
  normalizeTask,
} from "@/lib/project-task-utils";
import { EmployeeTaskBoard } from "./employee-task-board";
import { EmployeeTaskDetailDialog } from "./employee-task-detail-dialog";
import type { EmployeeTaskStage } from "./employee-task-list-shared";

interface EmployeeTaskListProps {
  projectId: string;
  currentUserId: string;
  assignees: { id: string; name: string; role: string }[];
}

export function EmployeeTaskList({ projectId, currentUserId, assignees }: EmployeeTaskListProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [stages, setStages] = useState<EmployeeTaskStage[]>([]);
  const [dailyCommentByTask, setDailyCommentByTask] = useState<Record<string, string>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const loadState = useCallback(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setStages((result.stages ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setTasks(
        result.data
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
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
          task.employeeAssigneeId === currentUserId ||
          (!task.employeeAssigneeId && task.assigneeId === currentUserId)
      ),
    [tasks, currentUserId]
  );
  const selectedTask = useMemo(
    () => myTasks.find((task) => task.id === selectedTaskId) ?? null,
    [myTasks, selectedTaskId]
  );
  const assigneeMap = useMemo(
    () => new Map(assignees.map((person) => [person.id, person])),
    [assignees]
  );

  const getStageLabel = useCallback(
    (task: ProjectTask) => stages.find((stage) => stage.id === task.stageId)?.name ?? "To Do",
    [stages]
  );

  const getAssignedTlName = useCallback(
    (task: ProjectTask) => {
      if (task.assignedTlId) {
        return assigneeMap.get(task.assignedTlId)?.name ?? "Not available";
      }

      const originalAssignee = assigneeMap.get(task.assigneeId);
      if (originalAssignee?.role === "TEAMLEADER") {
        return originalAssignee.name;
      }

      return "Not available";
    },
    [assigneeMap]
  );
  const groupedTasks = useMemo(() => {
    const initial: Record<string, ProjectTask[]> = {};
    for (const stage of stages) {
      initial[stage.id] = [];
    }

    for (const task of myTasks) {
      const fallbackStageId = stages[0]?.id;
      const stageId = task.stageId && initial[task.stageId] ? task.stageId : fallbackStageId;
      if (!stageId) continue;
      initial[stageId].push(task);
    }

    return initial;
  }, [myTasks, stages]);

  const submitDailyUpdate = (taskId: string) => {
    const comment = (dailyCommentByTask[taskId] || "").trim();

    if (!comment) {
      toast.error("Daily comment is required");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", taskId);
    formData.append("comment", comment);

    addProjectTaskDailyUpdate(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }

      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
      setDailyCommentByTask((current) => ({ ...current, [taskId]: "" }));
      toast.success("Daily task update saved");
    });
  };

  const moveTaskToStage = (taskId: string, targetStageId: string) => {
    if (!targetStageId) {
      toast.error("Select a stage");
      return;
    }

    const task = myTasks.find((item) => item.id === taskId);
    if (!task) {
      toast.error("Task not found");
      return;
    }
    if (task.stageId === targetStageId) {
      return;
    }

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
      setTasks(
        (result.data ?? [])
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
      toast.success("Task stage updated");
    });
  };

  const moveTaskStage = (taskId: string) => {
    moveTaskToStage(taskId, selectedStageId);
  };

  const openTaskDetails = (task: ProjectTask) => {
    setSelectedTaskId(task.id);
    setSelectedStageId(task.stageId ?? stages[0]?.id ?? "");
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedTaskId(null);
      setSelectedStageId("");
    }
  };

  const handleDragStart = (taskId: string, event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/plain", taskId);
    event.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(taskId);
  };

  const handleDragEnd = () => {
    setDraggingTaskId(null);
    setDragOverStageId(null);
  };

  const handleDragOverStage = (stageId: string, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOverStageId(stageId);
  };

  const handleDragLeaveStage = (stageId: string) => {
    setDragOverStageId((current) => (current === stageId ? null : current));
  };

  const handleDropStage = (
    stageId: string,
    event: DragEvent<HTMLDivElement>,
    fallbackTaskId: string | null
  ) => {
    event.preventDefault();
    const droppedTaskId = event.dataTransfer.getData("text/plain") || fallbackTaskId;
    if (!droppedTaskId) return;
    moveTaskToStage(droppedTaskId, stageId);
    setDraggingTaskId(null);
    setDragOverStageId(null);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>My Tasks</CardTitle>
          <div className="inline-flex rounded-md border bg-background p-1">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {myTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks assigned by team leader yet.</p>
        ) : viewMode === "kanban" ? (
          <EmployeeTaskBoard
            dragOverStageId={dragOverStageId}
            draggingTaskId={draggingTaskId}
            getAssignedTlName={getAssignedTlName}
            groupedTasks={groupedTasks}
            onDragEnd={handleDragEnd}
            onDragLeaveStage={handleDragLeaveStage}
            onDragOverStage={handleDragOverStage}
            onDragStart={handleDragStart}
            onDropStage={handleDropStage}
            onOpenTask={openTaskDetails}
            stages={stages}
          />
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-left">
                  <th className="px-4 py-3 font-medium">Task Name</th>
                  <th className="px-4 py-3 font-medium">Assigned TL</th>
                  <th className="px-4 py-3 font-medium">Task Stage</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {myTasks.map((task) => (
                  <tr key={task.id} className="border-t">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={() => openTaskDetails(task)}
                      >
                        {task.title}
                      </button>
                    </td>
                    <td className="px-4 py-3">{getAssignedTlName(task)}</td>
                    <td className="px-4 py-3">{getStageLabel(task)}</td>
                    <td className="px-4 py-3">
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <EmployeeTaskDetailDialog
        dailyComment={selectedTask ? (dailyCommentByTask[selectedTask.id] || "") : ""}
        getAssignedTlName={getAssignedTlName}
        getStageLabel={getStageLabel}
        onCommentChange={(value) => {
          if (!selectedTask) return;
          setDailyCommentByTask((current) => ({
            ...current,
            [selectedTask.id]: value,
          }));
        }}
        onOpenChange={handleDialogOpenChange}
        onSelectedStageChange={setSelectedStageId}
        onSubmitDailyUpdate={submitDailyUpdate}
        onUpdateStage={moveTaskStage}
        open={!!selectedTask}
        selectedStageId={selectedStageId}
        selectedTask={selectedTask}
        stages={stages}
      />
    </Card>
  );
}
