"use client";

import { Star, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectTaskDeadlineEditor } from "@/components/projects/project-task-deadline-editor";
import { TaskAssigneePopoverContent } from "@/components/projects/admin-project-task-monitor-parts/task-assignee-popover-content";
import {
  getEmployeeAvatarLetter,
  getStageRibbonClipPath,
  type TaskStageItem,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import {
  getTaskPriorityLabel,
  getTaskPriorityLevel,
  getTaskStatus,
  type ProjectTask,
} from "@/lib/project-task-utils";

interface DetailTaskSummaryProps {
  assigningTaskId: string | null;
  employeeAssignments: TeamPerson[];
  handleTaskDeadlineUpdated: (taskId: string, dueDate: string | undefined) => void;
  movingTaskId: string | null;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  onAssignTaskToSprint: (task: ProjectTask, sprintId: string | null) => void | Promise<void>;
  onMoveTaskToStage: (task: ProjectTask, targetStageId: string) => void | Promise<void>;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
  onSetTaskAssigneePopoverTaskId: (value: string | null) => void;
  isUpdatingTaskSprint: boolean;
  projectId: string;
  projectName?: string | null;
  selectedTask: ProjectTask;
  taskSprintId: string | null;
  taskSprintOptions: Array<{ id: string; label: string }>;
  stages: TaskStageItem[];
  standaloneTaskPage: boolean;
  taskAssignee: TeamPerson | null;
  taskAssigneePopoverTaskId: string | null;
}

export function DetailTaskSummary({
  assigningTaskId,
  employeeAssignments,
  handleTaskDeadlineUpdated,
  isUpdatingTaskSprint,
  movingTaskId,
  onAssignEmployeeToTask,
  onAssignTaskToSprint,
  onMoveTaskToStage,
  onOpenTaskEmployeeProfile,
  onSetTaskAssigneePopoverTaskId,
  projectId,
  projectName,
  selectedTask,
  taskSprintId,
  taskSprintOptions,
  stages,
  standaloneTaskPage,
  taskAssignee,
  taskAssigneePopoverTaskId,
}: DetailTaskSummaryProps) {
  const detailAssigneePopoverId = `${selectedTask.id}-detail-assignee`;

  const assigneePopover = (
    <Popover
      open={taskAssigneePopoverTaskId === detailAssigneePopoverId}
      onOpenChange={(open) => onSetTaskAssigneePopoverTaskId(open ? detailAssigneePopoverId : null)}
    >
      <PopoverTrigger asChild>
        {standaloneTaskPage ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto justify-start px-0 py-0 text-left text-[1.05rem] font-normal text-slate-900 hover:bg-transparent hover:text-[#44a2de]"
          >
            {taskAssignee ? taskAssignee.name : "Assign project team"}
          </Button>
        ) : taskAssignee ? (
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#c89212] text-sm font-semibold text-white">
              {getEmployeeAvatarLetter(taskAssignee.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">{taskAssignee.name}</span>
              <span className="block truncate text-xs text-slate-500">
                {taskAssignee.email || "No email address"}
              </span>
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500">
              <Users className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">Assign project team</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[280px] max-w-[calc(100vw-2rem)] border-slate-200 bg-white p-2 text-slate-900 shadow-lg"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <TaskAssigneePopoverContent
          task={selectedTask}
          taskAssignee={taskAssignee}
          employeeAssignments={employeeAssignments}
          assigningTaskId={assigningTaskId}
          onAssignEmployeeToTask={onAssignEmployeeToTask}
          onOpenTaskEmployeeProfile={onOpenTaskEmployeeProfile}
        />
      </PopoverContent>
    </Popover>
  );

  if (standaloneTaskPage) {
    return (
      <>
        <div className="flex min-h-[72px] items-center border-b border-slate-200 px-5 py-0 text-left">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[2.15rem] font-light leading-none tracking-tight text-slate-950">
                {selectedTask.title}
              </h1>
            </div>
            <div className="max-w-full overflow-x-auto pb-1">
              <div className="flex min-w-max items-center">
                {stages.map((stage, index) => {
                  const isActive = (selectedTask.stageId || stages[0]?.id || "") === stage.id;
                  const isUpdating = movingTaskId === selectedTask.id && isActive;
                  const stageZIndex = isActive ? stages.length + 1 : stages.length - index;
                  const stageFill = isActive ? "#ecfeff" : "#f1f5f9";

                  return (
                    <button
                      key={stage.id}
                      type="button"
                      disabled={movingTaskId === selectedTask.id}
                      onClick={() => {
                        void onMoveTaskToStage(selectedTask, stage.id);
                      }}
                      className={`relative h-10 shrink-0 overflow-hidden px-7 text-[15px] font-medium transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-70 ${
                        isActive
                          ? "bg-cyan-50 text-cyan-700 shadow-[inset_0_-2px_0_0_#22d3ee]"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-50"
                      } ${index === 0 ? "pl-6" : "-ml-[14px] pl-8"} ${index === stages.length - 1 ? "pr-6" : "pr-8"}`}
                      style={{ clipPath: getStageRibbonClipPath(index, stages.length), zIndex: stageZIndex }}
                      aria-label={`Move task to ${stage.name}`}
                    >
                      {index > 0 ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-0 w-[14px] bg-white [clip-path:polygon(0_50%,100%_0,100%_100%)]"
                        />
                      ) : null}
                      {index < stages.length - 1 ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-0 w-[14px] bg-white [clip-path:polygon(0_0,100%_50%,0_100%)]"
                          />
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 right-[2px] w-[12px] [clip-path:polygon(0_0,100%_50%,0_100%)]"
                            style={{ backgroundColor: stageFill }}
                          />
                        </>
                      ) : null}
                      <span className="relative z-10">{isUpdating ? "Updating..." : stage.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-5 py-5">
          <div className="grid gap-x-16 gap-y-8 md:grid-cols-2">
            <div className="space-y-8">
              <div className="space-y-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">Project</p>
                <p className="text-[1.05rem] text-slate-900">{projectName || "Current Project Task"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">Assignees</p>
                {assigneePopover}
              </div>
            </div>

            <div className="space-y-1">
              <div className="space-y-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">Deadline</p>
                <ProjectTaskDeadlineEditor
                  key={`${selectedTask.id}-${selectedTask.dueDate ?? "none"}-standalone`}
                  projectId={projectId}
                  task={selectedTask}
                  canEdit
                  onUpdated={(dueDate) => handleTaskDeadlineUpdated(selectedTask.id, dueDate)}
                  valueClassName="text-[1.05rem] font-normal text-slate-900"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[0.95rem] font-semibold text-slate-900">Sprint</p>
                <Select
                  value={taskSprintId ?? "__none__"}
                  disabled={isUpdatingTaskSprint || taskSprintOptions.length === 0}
                  onValueChange={(value) => {
                    void onAssignTaskToSprint(selectedTask, value === "__none__" ? null : value);
                  }}
                >
                  <SelectTrigger className="h-11 w-full max-w-[320px] rounded-lg border-slate-200 bg-white text-[1.05rem] font-normal text-slate-900">
                    <SelectValue placeholder={taskSprintOptions.length === 0 ? "No sprints available" : "Assign sprint"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No sprint assigned</SelectItem>
                    {taskSprintOptions.map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        {sprint.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <DialogTitle className="text-3xl font-light tracking-tight text-slate-950">
              {selectedTask.title}
            </DialogTitle>
            <div className="flex items-center gap-2 text-amber-400">
              {Array.from({ length: 3 }).map((_, index) => {
                const filled = index < getTaskPriorityLevel(selectedTask);
                return (
                  <Star
                    key={`selected-priority-${index}`}
                    className={`h-7 w-7 ${filled ? "fill-current text-amber-400" : "text-slate-300"}`}
                  />
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm text-cyan-700">
              {stages.find((stage) => stage.id === selectedTask.stageId)?.name ?? "To Do"}
            </Badge>
            <Badge className="rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-700">
              {getTaskStatus(selectedTask)}
            </Badge>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-6 px-6 py-5">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-500">Project</p>
              <p className="text-lg font-medium text-slate-950">{projectName || "Current Project Task"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-500">Assignee</p>
              {assigneePopover}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-500">Priority</p>
              <p className="text-sm text-slate-800">{getTaskPriorityLabel(selectedTask)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-500">Deadline</p>
              <ProjectTaskDeadlineEditor
                key={`${selectedTask.id}-${selectedTask.dueDate ?? "none"}-dialog`}
                projectId={projectId}
                task={selectedTask}
                canEdit
                onUpdated={(dueDate) => handleTaskDeadlineUpdated(selectedTask.id, dueDate)}
                valueClassName="text-sm font-normal text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-500">Sprint</p>
              <Select
                value={taskSprintId ?? "__none__"}
                disabled={isUpdatingTaskSprint || taskSprintOptions.length === 0}
                onValueChange={(value) => {
                  void onAssignTaskToSprint(selectedTask, value === "__none__" ? null : value);
                }}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-sm font-normal text-slate-800">
                  <SelectValue placeholder={taskSprintOptions.length === 0 ? "No sprints available" : "Assign sprint"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No sprint assigned</SelectItem>
                  {taskSprintOptions.map((sprint) => (
                    <SelectItem key={sprint.id} value={sprint.id}>
                      {sprint.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
