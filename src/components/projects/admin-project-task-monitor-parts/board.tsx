"use client";

import { memo, useState, type Dispatch, type SetStateAction } from "react";
import { AdminAddStageDialog } from "@/components/projects/admin-add-stage-dialog";
import { AdminDeleteStageAlert } from "@/components/projects/admin-delete-stage-alert";
import { BoardContent } from "@/components/projects/admin-project-task-monitor-parts/board-content";
import { BoardToolbar } from "@/components/projects/admin-project-task-monitor-parts/board-toolbar";
import { EmployeeProfileDialog } from "@/components/projects/admin-project-task-monitor-parts/employee-profile-dialog";
import { TaskComposerDialog } from "@/components/projects/admin-project-task-monitor-parts/task-composer-dialog";
import {
  type AdminProjectTaskMonitorProps,
  type TaskStageItem,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import { useAdminProjectTaskBoardActions } from "@/components/projects/admin-project-task-monitor-parts/use-admin-project-task-board-actions";
import { useAdminProjectTaskBoardFilters } from "@/components/projects/admin-project-task-monitor-parts/use-admin-project-task-board-filters";
import { useProjectTaskPeople } from "@/components/projects/admin-project-task-monitor-parts/use-project-task-people";
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
import type { ProjectTask } from "@/lib/project-task-utils";

interface AdminProjectTaskBoardProps {
  projectId: string;
  assignments: AdminProjectTaskMonitorProps["assignments"];
  employees: AdminProjectTaskMonitorProps["employees"];
  projectTeamId?: AdminProjectTaskMonitorProps["projectTeamId"];
  projectCategory?: AdminProjectTaskMonitorProps["projectCategory"];
  projectManagerName?: AdminProjectTaskMonitorProps["projectManagerName"];
  projectName?: AdminProjectTaskMonitorProps["projectName"];
  projectTags?: AdminProjectTaskMonitorProps["projectTags"];
  projectType: AdminProjectTaskMonitorProps["projectType"];
  setStages: Dispatch<SetStateAction<TaskStageItem[]>>;
  setTasks: Dispatch<SetStateAction<ProjectTask[]>>;
  stages: TaskStageItem[];
  tasks: ProjectTask[];
  onOpenTask: (taskId: string) => void;
  openingTaskId: string | null;
}

function AdminProjectTaskBoardComponent({
  projectId,
  assignments,
  employees,
  projectTeamId,
  projectCategory,
  projectManagerName,
  projectName,
  projectTags,
  projectType,
  setStages,
  setTasks,
  stages,
  tasks,
  onOpenTask,
  openingTaskId,
}: AdminProjectTaskBoardProps) {
  const { employeeAssignments, peopleMap, projectAssignableIds } = useProjectTaskPeople({
    assignments,
    employees,
    projectTeamId,
  });
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<ProjectTask | null>(null);

  const filters = useAdminProjectTaskBoardFilters({
    peopleMap,
    projectCategory,
    projectManagerName,
    projectName,
    projectTags,
    projectType,
    stages,
    tasks,
  });

  const actions = useAdminProjectTaskBoardActions({
    employeeAssignments,
    projectAssignableIds,
    projectId,
    setStages,
    setTasks,
    stages,
    tasks,
  });

  return (
    <>
      <BoardToolbar
        activeFilter={filters.activeFilter}
        activeGroupBy={filters.activeGroupBy}
        boardSearch={filters.boardSearch}
        employeeAssignments={employeeAssignments}
        projectId={projectId}
        hasActiveToolbarFilters={filters.hasActiveToolbarFilters}
        isSavingTask={actions.isSavingTask}
        isSearchMenuOpen={filters.isSearchMenuOpen}
        onAddTask={actions.addTask}
        onActiveFilterChange={filters.setActiveFilter}
        onActiveGroupByChange={filters.setActiveGroupBy}
        onBoardSearchChange={filters.setBoardSearch}
        onCloseQuickAddTaskCard={actions.closeQuickAddTaskCard}
        onOpenQuickAddTaskCard={actions.openQuickAddTaskCard}
        onClearTaskAssignee={actions.clearTaskAssignee}
        onResetFilters={filters.clearBoardFilters}
        onSearchMenuOpenChange={filters.setIsSearchMenuOpen}
        onSelectTaskAssignee={actions.selectTaskAssignee}
        onTaskAssigneeQueryChange={actions.updateTaskAssigneeQuery}
        setTaskTitle={actions.setTaskTitle}
        setViewMode={filters.setViewMode}
        showQuickAddTaskCard={actions.showQuickAddTaskCard}
        taskAssigneeQuery={actions.taskAssigneeQuery}
        taskFilterConfig={filters.boardTaskFilterConfig}
        taskTitle={actions.taskTitle}
        viewMode={filters.viewMode}
      />

      <BoardContent
        assigningTaskId={actions.assigningTaskId}
        draggedTaskId={actions.draggedTaskId}
        dragOverStageId={actions.dragOverStageId}
        editingStageId={actions.editingStageId}
        editingStageName={actions.editingStageName}
        employeeAssignments={employeeAssignments}
        filteredGroupedTasks={filters.filteredGroupedTasks}
        filteredStageSummaries={filters.filteredStageSummaries}
        filteredTasks={filters.filteredTasks}
        foldedStages={filters.foldedStages}
        groupedTasks={filters.groupedTasks}
        hasTaskFilteringCriteria={filters.hasTaskFilteringCriteria}
        isSavingStage={actions.isSavingStage}
        movingTaskId={actions.movingTaskId}
        newStageName={actions.newStageName}
        onAddStage={actions.addStage}
        onAssignEmployeeToTask={actions.assignEmployeeToTask}
        onCancelEditStage={actions.cancelEditStage}
        onDeleteStageRequest={actions.setDeleteStageTarget}
        onDeleteTaskRequest={setDeleteTaskTarget}
        onEditStageNameChange={actions.setEditingStageName}
        onHandleStageDragOver={actions.handleStageDragOver}
        onHandleStageDrop={actions.handleStageDrop}
        onHandleTaskDragEnd={actions.handleTaskDragEnd}
        onHandleTaskDragStart={actions.handleTaskDragStart}
        onOpenTask={onOpenTask}
        onOpenTaskEmployeeProfile={actions.openTaskEmployeeProfile}
        onSaveStageName={actions.saveStageName}
        onSetNewStageName={actions.setNewStageName}
        onSetShowAddStageInput={actions.setShowAddStageInput}
        onSetTaskAssigneePopoverTaskId={actions.setTaskAssigneePopoverTaskId}
        onStartEditStage={actions.startEditStage}
        onStartEditTask={actions.startEditTask}
        onToggleStageFold={filters.toggleStageFold}
        getResponsibleName={filters.getResponsibleName}
        getStageName={filters.getStageName}
        getTaskAssigneePerson={filters.getTaskAssigneePerson}
        showAddStageInput={actions.showAddStageInput}
        stages={stages}
        taskAssigneePopoverTaskId={actions.taskAssigneePopoverTaskId}
        openingTaskId={openingTaskId}
        viewMode={filters.viewMode}
      />

      <TaskComposerDialog
        editingTaskId={actions.editingTaskId}
        employeeAssignments={employeeAssignments}
        isSavingTask={actions.isSavingTask}
        projectId={projectId}
        onAddTask={actions.addTask}
        onOpenChange={actions.setShowAddTaskDialog}
        onResetTaskDialog={actions.resetTaskDialog}
        onClearTaskAssignee={actions.clearTaskAssignee}
        onSelectTaskAssignee={actions.selectTaskAssignee}
        onTaskAssigneeQueryChange={actions.updateTaskAssigneeQuery}
        open={actions.showAddTaskDialog}
        stages={stages}
        taskAssigneeQuery={actions.taskAssigneeQuery}
        taskDescription={actions.taskDescription}
        taskDueDate={actions.taskDueDate}
        taskPriority={actions.taskPriority}
        taskStageId={actions.taskStageId}
        taskTitle={actions.taskTitle}
        setTaskDescription={actions.setTaskDescription}
        setTaskDueDate={actions.setTaskDueDate}
        setTaskPriority={actions.setTaskPriority}
        setTaskStageId={actions.setTaskStageId}
        setTaskTitle={actions.setTaskTitle}
      />

      <EmployeeProfileDialog
        selectedTaskEmployeeProfile={actions.selectedTaskEmployeeProfile}
        onOpenChange={(open) => {
          if (!open) {
            actions.setSelectedTaskEmployeeProfile(null);
          }
        }}
      />

      <AdminAddStageDialog
        open={filters.viewMode === "list" && actions.showAddStageInput}
        onOpenChange={actions.setShowAddStageInput}
        stageName={actions.newStageName}
        onStageNameChange={actions.setNewStageName}
        isSaving={actions.isSavingStage}
        onCancel={() => {
          actions.setShowAddStageInput(false);
          actions.setNewStageName("");
        }}
        onAdd={actions.addStage}
      />

      <AdminDeleteStageAlert
        target={actions.deleteStageTarget ? { id: actions.deleteStageTarget.id, name: actions.deleteStageTarget.name } : null}
        isSaving={actions.isSavingStage}
        onCancel={() => actions.setDeleteStageTarget(null)}
        onConfirm={(id) => {
          actions.deleteStage(id);
          actions.setDeleteStageTarget(null);
        }}
      />

      <AlertDialog open={Boolean(deleteTaskTarget)} onOpenChange={(open) => !open && setDeleteTaskTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the selected task.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTaskTarget) return;
                actions.deleteTask(deleteTaskTarget);
                setDeleteTaskTarget(null);
              }}
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

export const AdminProjectTaskBoard = memo(AdminProjectTaskBoardComponent);
AdminProjectTaskBoard.displayName = "AdminProjectTaskBoard";
