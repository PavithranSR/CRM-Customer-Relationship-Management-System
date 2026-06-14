"use client";

import type { DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BoardAddStageColumn } from "@/components/projects/admin-project-task-monitor-parts/board-add-stage-column";
import { BoardListView } from "@/components/projects/admin-project-task-monitor-parts/board-list-view";
import { BoardStageColumn } from "@/components/projects/admin-project-task-monitor-parts/board-stage-column";
import { type TaskStageItem, type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";
import { getTaskStatus, type ProjectTask } from "@/lib/project-task-utils";

interface BoardContentProps {
  draggedTaskId: string | null;
  dragOverStageId: string | null;
  editingStageId: string | null;
  editingStageName: string;
  employeeAssignments: TeamPerson[];
  filteredGroupedTasks: Record<string, ProjectTask[]>;
  filteredStageSummaries: Map<string, { count: number; averageProgress: number }>;
  filteredTasks: ProjectTask[];
  foldedStages: Record<string, boolean>;
  groupedTasks: Record<string, ProjectTask[]>;
  hasTaskFilteringCriteria: boolean;
  isSavingStage: boolean;
  movingTaskId: string | null;
  onAddStage: () => void;
  onCancelEditStage: () => void;
  onDeleteStageRequest: (stage: TaskStageItem) => void;
  onEditStageNameChange: (value: string) => void;
  onHandleStageDrop: (stageId: string, event: DragEvent<HTMLElement>) => void | Promise<void>;
  onHandleStageDragOver: (stageId: string, event: DragEvent<HTMLElement>) => void;
  onHandleTaskDragEnd: () => void;
  onHandleTaskDragStart: (task: ProjectTask, event: DragEvent<HTMLDivElement>) => void;
  onOpenTask: (taskId: string) => void;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
  onDeleteTaskRequest: (task: ProjectTask) => void;
  onSaveStageName: () => void;
  onSetNewStageName: (value: string) => void;
  onSetShowAddStageInput: (value: boolean) => void;
  onSetTaskAssigneePopoverTaskId: (value: string | null) => void;
  onStartEditStage: (stageId: string, stageName: string) => void;
  onStartEditTask: (task: ProjectTask) => void;
  onToggleStageFold: (stageId: string) => void;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  getTaskAssigneePerson: (task: ProjectTask) => TeamPerson | null;
  getStageName: (task: ProjectTask) => string;
  getResponsibleName: (task: ProjectTask) => string;
  newStageName: string;
  showAddStageInput: boolean;
  stages: TaskStageItem[];
  taskAssigneePopoverTaskId: string | null;
  openingTaskId: string | null;
  viewMode: "kanban" | "list";
  assigningTaskId: string | null;
}

export function BoardContent({
  assigningTaskId,
  draggedTaskId,
  dragOverStageId,
  editingStageId,
  editingStageName,
  employeeAssignments,
  filteredGroupedTasks,
  filteredStageSummaries,
  filteredTasks,
  foldedStages,
  groupedTasks,
  hasTaskFilteringCriteria,
  isSavingStage,
  movingTaskId,
  newStageName,
  onAddStage,
  onAssignEmployeeToTask,
  onCancelEditStage,
  onDeleteStageRequest,
  onEditStageNameChange,
  onHandleStageDragOver,
  onHandleStageDrop,
  onHandleTaskDragEnd,
  onHandleTaskDragStart,
  onOpenTask,
  onOpenTaskEmployeeProfile,
  onDeleteTaskRequest,
  onSaveStageName,
  onSetNewStageName,
  onSetShowAddStageInput,
  onSetTaskAssigneePopoverTaskId,
  onStartEditStage,
  onStartEditTask,
  onToggleStageFold,
  showAddStageInput,
  stages,
  taskAssigneePopoverTaskId,
  openingTaskId,
  viewMode,
  getResponsibleName,
  getStageName,
  getTaskAssigneePerson,
}: BoardContentProps) {
  if (viewMode === "list") {
    return (
      <BoardListView
        filteredTasks={filteredTasks}
        hasTaskFilteringCriteria={hasTaskFilteringCriteria}
        onOpenTask={onOpenTask}
        onStartEditTask={onStartEditTask}
        getResponsibleName={getResponsibleName}
        getStageName={getStageName}
        getTaskStatus={getTaskStatus}
      />
    );
  }

  if (stages.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50/60">
        <CardContent className="py-12 text-center">
          <p className="text-base font-medium text-slate-800">No task stages yet</p>
          <p className="mt-1 text-sm text-slate-500">Create a stage to start organizing project work.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="relative flex min-w-[920px] items-start gap-4 pb-2">
        {stages.map((stage, stageIndex) => (
          <BoardStageColumn
            key={stage.id}
            assigningTaskId={assigningTaskId}
            draggedTaskId={draggedTaskId}
            dragOverStageId={dragOverStageId}
            editingStageId={editingStageId}
            editingStageName={editingStageName}
            employeeAssignments={employeeAssignments}
            foldedStages={foldedStages}
            groupedTasks={groupedTasks}
            hasTaskFilteringCriteria={hasTaskFilteringCriteria}
            isSavingStage={isSavingStage}
            movingTaskId={movingTaskId}
            onAssignEmployeeToTask={onAssignEmployeeToTask}
            onCancelEditStage={onCancelEditStage}
            onDeleteStageRequest={onDeleteStageRequest}
            onEditStageNameChange={onEditStageNameChange}
            onHandleStageDragOver={onHandleStageDragOver}
            onHandleStageDrop={onHandleStageDrop}
            onHandleTaskDragEnd={onHandleTaskDragEnd}
            onHandleTaskDragStart={onHandleTaskDragStart}
            onOpenTask={onOpenTask}
            onOpenTaskEmployeeProfile={onOpenTaskEmployeeProfile}
            onDeleteTaskRequest={onDeleteTaskRequest}
            onSaveStageName={onSaveStageName}
            onSetTaskAssigneePopoverTaskId={onSetTaskAssigneePopoverTaskId}
            onStartEditStage={onStartEditStage}
            onStartEditTask={onStartEditTask}
            onToggleStageFold={onToggleStageFold}
            stage={stage}
            stageIndex={stageIndex}
            stageSummary={filteredStageSummaries.get(stage.id) ?? { count: 0, averageProgress: 0 }}
            stageTasks={filteredGroupedTasks[stage.id] ?? []}
            stages={stages}
            taskAssigneePopoverTaskId={taskAssigneePopoverTaskId}
            openingTaskId={openingTaskId}
            getTaskAssigneePerson={getTaskAssigneePerson}
          />
        ))}

        <BoardAddStageColumn
          isSavingStage={isSavingStage}
          newStageName={newStageName}
          onAddStage={onAddStage}
          onSetNewStageName={onSetNewStageName}
          onSetShowAddStageInput={onSetShowAddStageInput}
          showAddStageInput={showAddStageInput}
        />
      </div>
    </div>
  );
}
