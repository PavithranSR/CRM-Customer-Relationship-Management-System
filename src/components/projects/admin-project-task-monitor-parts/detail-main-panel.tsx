"use client";

import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DetailDescriptionTab,
} from "@/components/projects/admin-project-task-monitor-parts/detail-description-tab";
import type { DescriptionPreviewPart } from "@/components/projects/admin-project-task-monitor-parts/detail-description-preview";
import { DetailSubtasksTab } from "@/components/projects/admin-project-task-monitor-parts/detail-subtasks-tab";
import { DetailTaskSummary } from "@/components/projects/admin-project-task-monitor-parts/detail-task-summary";
import { type TaskStageItem, type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";
import type { ProjectTask } from "@/lib/project-task-utils";

interface DetailMainPanelProps {
  assigningTaskId: string | null;
  buttonLabel: string;
  buttonSize: string;
  buttonTheme: string;
  buttonUrl: string;
  buttonVariant: string;
  descriptionDraft: string;
  descriptionInputRef: RefObject<HTMLTextAreaElement | null>;
  descriptionPreviewContent: DescriptionPreviewPart[];
  descriptionUploadInputRef: RefObject<HTMLInputElement | null>;
  employeeAssignments: TeamPerson[];
  isAddingSubtask: boolean;
  isSavingDescription: boolean;
  isUpdatingTaskSprint: boolean;
  movingTaskId: string | null;
  onAddSubtask: () => void;
  onApplyDescriptionButton: () => void;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  onAssignTaskToSprint: (task: ProjectTask, sprintId: string | null) => void | Promise<void>;
  onButtonLabelChange: (value: string) => void;
  onButtonSizeChange: (value: string) => void;
  onButtonThemeChange: (value: string) => void;
  onButtonUrlChange: (value: string) => void;
  onButtonVariantChange: (value: string) => void;
  onDescriptionDraftChange: (value: string) => void;
  onDescriptionUploadChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onHandleDescriptionKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onInsertBulletListItem: () => void;
  onInsertChecklistItem: () => void;
  onInsertIntoDescription: (snippet: string) => void;
  onInsertNumberedListItem: () => void;
  onMoveTaskToStage: (task: ProjectTask, targetStageId: string) => void | Promise<void>;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
  onResetSubtaskForm: () => void;
  onSaveTaskDescription: () => void;
  onSetIsMediaPickerOpen: (value: boolean) => void;
  onSetShowButtonBuilder: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetShowSubtaskForm: (value: boolean) => void;
  onSetSubtaskAssigneeId: (value: string) => void;
  onSetSubtaskTitle: (value: string) => void;
  onSetTaskAssigneePopoverTaskId: (value: string | null) => void;
  peopleMap: Map<string, TeamPerson>;
  projectId: string;
  projectName?: string | null;
  projectTeamMembers: TeamPerson[];
  selectedTask: ProjectTask;
  taskSprintId: string | null;
  taskSprintOptions: Array<{ id: string; label: string }>;
  showButtonBuilder: boolean;
  showSubtaskForm: boolean;
  stages: TaskStageItem[];
  standaloneTaskPage: boolean;
  subtaskAssigneeId: string;
  subtaskTitle: string;
  taskAssignee: TeamPerson | null;
  taskAssigneePopoverTaskId: string | null;
  handleTaskDeadlineUpdated: (taskId: string, dueDate: string | undefined) => void;
}

export function DetailMainPanel({
  assigningTaskId,
  buttonLabel,
  buttonSize,
  buttonTheme,
  buttonUrl,
  buttonVariant,
  descriptionDraft,
  descriptionInputRef,
  descriptionPreviewContent,
  descriptionUploadInputRef,
  employeeAssignments,
  handleTaskDeadlineUpdated,
  isAddingSubtask,
  isSavingDescription,
  isUpdatingTaskSprint,
  movingTaskId,
  onAddSubtask,
  onApplyDescriptionButton,
  onAssignEmployeeToTask,
  onAssignTaskToSprint,
  onButtonLabelChange,
  onButtonSizeChange,
  onButtonThemeChange,
  onButtonUrlChange,
  onButtonVariantChange,
  onDescriptionDraftChange,
  onDescriptionUploadChange,
  onHandleDescriptionKeyDown,
  onInsertBulletListItem,
  onInsertChecklistItem,
  onInsertIntoDescription,
  onInsertNumberedListItem,
  onMoveTaskToStage,
  onOpenTaskEmployeeProfile,
  onResetSubtaskForm,
  onSaveTaskDescription,
  onSetIsMediaPickerOpen,
  onSetShowButtonBuilder,
  onSetShowSubtaskForm,
  onSetSubtaskAssigneeId,
  onSetSubtaskTitle,
  onSetTaskAssigneePopoverTaskId,
  peopleMap,
  projectId,
  projectName,
  projectTeamMembers,
  selectedTask,
  taskSprintId,
  taskSprintOptions,
  showButtonBuilder,
  showSubtaskForm,
  stages,
  standaloneTaskPage,
  subtaskAssigneeId,
  subtaskTitle,
  taskAssignee,
  taskAssigneePopoverTaskId,
}: DetailMainPanelProps) {
  return (
    <div className={`border-b border-slate-200 lg:border-b-0 lg:border-r ${standaloneTaskPage ? "" : "min-h-0 overflow-y-auto"}`}>
      <DetailTaskSummary
        assigningTaskId={assigningTaskId}
        employeeAssignments={employeeAssignments}
        handleTaskDeadlineUpdated={handleTaskDeadlineUpdated}
        isUpdatingTaskSprint={isUpdatingTaskSprint}
        movingTaskId={movingTaskId}
        onAssignEmployeeToTask={onAssignEmployeeToTask}
        onAssignTaskToSprint={onAssignTaskToSprint}
        onMoveTaskToStage={onMoveTaskToStage}
        onOpenTaskEmployeeProfile={onOpenTaskEmployeeProfile}
        onSetTaskAssigneePopoverTaskId={onSetTaskAssigneePopoverTaskId}
        projectId={projectId}
        projectName={projectName}
        selectedTask={selectedTask}
        taskSprintId={taskSprintId}
        taskSprintOptions={taskSprintOptions}
        stages={stages}
        standaloneTaskPage={standaloneTaskPage}
        taskAssignee={taskAssignee}
        taskAssigneePopoverTaskId={taskAssigneePopoverTaskId}
      />

      <Tabs
        className={standaloneTaskPage ? "space-y-0 bg-white" : "space-y-0 overflow-hidden rounded-xl border border-slate-200 bg-white"}
        defaultValue="description"
      >
        <TabsList
          className={standaloneTaskPage ? "h-auto justify-start rounded-none border-b border-slate-200 bg-white p-0 px-5" : "h-auto justify-start rounded-none border-b border-slate-200 bg-white p-0"}
        >
          <TabsTrigger
            value="description"
            className="rounded-none border-t-2 border-transparent px-5 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-cyan-700"
          >
            Description
          </TabsTrigger>
          <TabsTrigger
            value="subtasks"
            className="rounded-none border-t-2 border-transparent px-5 py-3 text-base text-slate-600 data-[state=active]:border-cyan-500 data-[state=active]:bg-slate-50 data-[state=active]:text-slate-900"
          >
            Sub-tasks
          </TabsTrigger>
        </TabsList>

        <DetailDescriptionTab
          buttonLabel={buttonLabel}
          buttonSize={buttonSize}
          buttonTheme={buttonTheme}
          buttonUrl={buttonUrl}
          buttonVariant={buttonVariant}
          descriptionDraft={descriptionDraft}
          descriptionInputRef={descriptionInputRef}
          descriptionPreviewContent={descriptionPreviewContent}
          descriptionUploadInputRef={descriptionUploadInputRef}
          isSavingDescription={isSavingDescription}
          onApplyDescriptionButton={onApplyDescriptionButton}
          onButtonLabelChange={onButtonLabelChange}
          onButtonSizeChange={onButtonSizeChange}
          onButtonThemeChange={onButtonThemeChange}
          onButtonUrlChange={onButtonUrlChange}
          onButtonVariantChange={onButtonVariantChange}
          onDescriptionDraftChange={onDescriptionDraftChange}
          onDescriptionUploadChange={onDescriptionUploadChange}
          onHandleDescriptionKeyDown={onHandleDescriptionKeyDown}
          onInsertBulletListItem={onInsertBulletListItem}
          onInsertChecklistItem={onInsertChecklistItem}
          onInsertIntoDescription={onInsertIntoDescription}
          onInsertNumberedListItem={onInsertNumberedListItem}
          onSaveTaskDescription={onSaveTaskDescription}
          onSetIsMediaPickerOpen={onSetIsMediaPickerOpen}
          onSetShowButtonBuilder={onSetShowButtonBuilder}
          showButtonBuilder={showButtonBuilder}
          standaloneTaskPage={standaloneTaskPage}
        />

        <DetailSubtasksTab
          isAddingSubtask={isAddingSubtask}
          onAddSubtask={onAddSubtask}
          onResetSubtaskForm={onResetSubtaskForm}
          onSetShowSubtaskForm={onSetShowSubtaskForm}
          onSetSubtaskAssigneeId={onSetSubtaskAssigneeId}
          onSetSubtaskTitle={onSetSubtaskTitle}
          peopleMap={peopleMap}
          projectTeamMembers={projectTeamMembers}
          selectedTask={selectedTask}
          showSubtaskForm={showSubtaskForm}
          subtaskAssigneeId={subtaskAssigneeId}
          subtaskTitle={subtaskTitle}
        />
      </Tabs>
    </div>
  );
}
