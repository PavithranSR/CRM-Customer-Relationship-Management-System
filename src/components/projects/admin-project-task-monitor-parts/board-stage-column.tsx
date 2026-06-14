"use client";

import type { DragEvent } from "react";
import { format } from "date-fns";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MoreVertical,
  Pencil,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskAssigneePopoverContent } from "@/components/projects/admin-project-task-monitor-parts/task-assignee-popover-content";
import {
  FOLDED_STAGE_THEMES,
  STAGE_THEMES,
  getEmployeeAvatarLetter,
  type TaskStageItem,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import {
  getTaskCompletionPercent,
  getTaskPriorityLevel,
  type ProjectTask,
} from "@/lib/project-task-utils";

const FOLDED_STAGE_WIDTH = 42;
const STAGE_WIDTH = 280;

interface BoardStageColumnProps {
  assigningTaskId: string | null;
  draggedTaskId: string | null;
  dragOverStageId: string | null;
  editingStageId: string | null;
  editingStageName: string;
  employeeAssignments: TeamPerson[];
  foldedStages: Record<string, boolean>;
  groupedTasks: Record<string, ProjectTask[]>;
  hasTaskFilteringCriteria: boolean;
  isSavingStage: boolean;
  movingTaskId: string | null;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  onCancelEditStage: () => void;
  onDeleteStageRequest: (stage: TaskStageItem) => void;
  onEditStageNameChange: (value: string) => void;
  onHandleStageDragOver: (stageId: string, event: DragEvent<HTMLElement>) => void;
  onHandleStageDrop: (stageId: string, event: DragEvent<HTMLElement>) => void | Promise<void>;
  onHandleTaskDragEnd: () => void;
  onHandleTaskDragStart: (task: ProjectTask, event: DragEvent<HTMLDivElement>) => void;
  onOpenTask: (taskId: string) => void;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
  onSaveStageName: () => void;
  onSetTaskAssigneePopoverTaskId: (value: string | null) => void;
  onStartEditStage: (stageId: string, stageName: string) => void;
  onStartEditTask: (task: ProjectTask) => void;
  onToggleStageFold: (stageId: string) => void;
  stage: TaskStageItem;
  stageIndex: number;
  stageSummary: { count: number; averageProgress: number };
  stageTasks: ProjectTask[];
  stages: TaskStageItem[];
  taskAssigneePopoverTaskId: string | null;
  openingTaskId: string | null;
  getTaskAssigneePerson: (task: ProjectTask) => TeamPerson | null;
  onDeleteTaskRequest: (task: ProjectTask) => void;
}

export function BoardStageColumn({
  assigningTaskId,
  draggedTaskId,
  dragOverStageId,
  editingStageId,
  editingStageName,
  employeeAssignments,
  foldedStages,
  groupedTasks,
  hasTaskFilteringCriteria,
  isSavingStage,
  movingTaskId,
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
  onSaveStageName,
  onSetTaskAssigneePopoverTaskId,
  onStartEditStage,
  onStartEditTask,
  onToggleStageFold,
  onDeleteTaskRequest,
  stage,
  stageIndex,
  stageSummary,
  stageTasks,
  stages,
  taskAssigneePopoverTaskId,
  openingTaskId,
  getTaskAssigneePerson,
}: BoardStageColumnProps) {
  const isFolded = foldedStages[stage.id] ?? false;
  const foldedThemeClass = FOLDED_STAGE_THEMES[stageIndex % FOLDED_STAGE_THEMES.length];
  const isDropTarget = dragOverStageId === stage.id && draggedTaskId !== null;

  return (
    <div
      style={{ width: isFolded ? FOLDED_STAGE_WIDTH : STAGE_WIDTH }}
      className={`shrink-0 ${isFolded ? "min-w-[42px] self-start" : "min-w-[280px]"}`}
    >
      <div
        className={
          isFolded
            ? `overflow-hidden rounded-none bg-transparent shadow-none ${
                isDropTarget ? "ring-2 ring-inset ring-cyan-300" : ""
              }`
            : `overflow-hidden rounded-none border border-slate-300 bg-white shadow-none ${
                isDropTarget ? "ring-2 ring-inset ring-cyan-300" : ""
              }`
        }
        onDragOver={(event) => onHandleStageDragOver(stage.id, event)}
        onDrop={(event) => {
          void onHandleStageDrop(stage.id, event);
        }}
      >
        {isFolded ? (
          <button
            type="button"
            className={`sticky top-0 z-20 flex min-h-[220px] w-full flex-col items-center rounded-none px-1.5 py-2 text-slate-700 shadow-none transition hover:brightness-[0.99] ${foldedThemeClass}`}
            onClick={() => onToggleStageFold(stage.id)}
            disabled={isSavingStage}
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
                {stage.name} ({stageSummary.count})
              </p>
            </div>
          </button>
        ) : (
          <>
            <div
              className={`sticky top-0 z-20 border-b border-slate-300 ${
                STAGE_THEMES[stageIndex % STAGE_THEMES.length]
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex flex-1 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    {editingStageId === stage.id ? (
                      <Input
                        value={editingStageName}
                        onChange={(event) => onEditStageNameChange(event.target.value)}
                        className="h-8 min-w-0 w-full max-w-[10rem] border-slate-300 bg-white"
                        autoFocus
                        disabled={isSavingStage}
                      />
                    ) : (
                      <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">{stage.name}</h3>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="h-6 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700"
                    >
                      {stageSummary.count}
                    </Badge>
                    {editingStageId === stage.id ? (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-500 hover:bg-white hover:text-slate-900"
                          onClick={onSaveStageName}
                          disabled={isSavingStage}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-slate-500 hover:bg-white hover:text-slate-900"
                          onClick={onCancelEditStage}
                          disabled={isSavingStage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-500 hover:bg-white hover:text-slate-900"
                            disabled={isSavingStage}
                            aria-label={`${stage.name} stage settings`}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            onClick={() => onStartEditStage(stage.id, stage.name)}
                            disabled={isSavingStage}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onToggleStageFold(stage.id)}
                            disabled={isSavingStage}
                          >
                            <ChevronRight className="mr-2 h-4 w-4 rotate-90" />
                            Fold
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteStageRequest(stage)}
                            disabled={
                              (groupedTasks[stage.id]?.length ?? 0) > 0 || stages.length <= 1 || isSavingStage
                            }
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-1 bg-white/70">
                <div
                  className="h-full bg-cyan-400 transition-[width]"
                  style={{ width: `${stageSummary.averageProgress}%` }}
                />
              </div>
            </div>

            {stageTasks.length === 0 ? (
              <div
                className={`flex min-h-[420px] items-center justify-center px-4 py-6 text-center text-sm transition-colors ${
                  isDropTarget ? "bg-cyan-50/40 text-cyan-700" : "text-slate-500"
                }`}
              >
                {hasTaskFilteringCriteria ? "No tasks match these filters." : "No tasks in this stage yet."}
              </div>
            ) : (
              <div className={`space-y-3 p-3 ${isDropTarget ? "bg-cyan-50/30" : "bg-transparent"}`}>
                {stageTasks.map((task) => {
                  const taskAssignee = getTaskAssigneePerson(task);
                  const subtaskCount = task.subtasks?.length ?? 0;
                  const dueDateLabel = task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No deadline";
                  const completionPercent = Math.round(getTaskCompletionPercent(task));

                  return (
                    <div
                      key={task.id}
                      draggable={movingTaskId === null}
                      onDragStart={(event) => onHandleTaskDragStart(task, event)}
                      onDragEnd={onHandleTaskDragEnd}
                      onClick={() => onOpenTask(task.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenTask(task.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-busy={openingTaskId === task.id}
                      className={`border border-slate-300 bg-white px-4 py-4 transition hover:bg-slate-50 ${
                        draggedTaskId === task.id || movingTaskId === task.id
                          ? "cursor-grabbing opacity-60"
                          : "cursor-pointer"
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[1.05rem] font-semibold text-slate-900">
                              {task.title}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 text-slate-400 hover:bg-transparent hover:text-slate-700"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                                aria-label="Task actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  onStartEditTask(task);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-700"
                                onSelect={(event) => {
                                  event.preventDefault();
                                  onDeleteTaskRequest(task);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-600">
                              <span>{subtaskCount}</span>
                              <span>{subtaskCount === 1 ? "Subtask" : "Subtasks"}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock3 className="h-3.5 w-3.5" />
                              <span>{dueDateLabel}</span>
                              <span className="text-slate-300">|</span>
                              <span>{completionPercent}% ready</span>
                            </div>
                            <div className="flex items-center gap-1 text-amber-500">
                              {Array.from({ length: 3 }).map((_, index) => {
                                const active = index < getTaskPriorityLevel(task);
                                return (
                                  <Star
                                    key={`${task.id}-priority-${index}`}
                                    className={`h-3.5 w-3.5 ${
                                      active ? "fill-amber-400 text-amber-400" : "text-slate-200"
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <Popover
                            open={taskAssigneePopoverTaskId === task.id}
                            onOpenChange={(open) => onSetTaskAssigneePopoverTaskId(open ? task.id : null)}
                          >
                            <PopoverTrigger asChild>
                              {taskAssignee ? (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-10 w-10 shrink-0 rounded-md bg-[#44a2de] text-base font-semibold text-white shadow-sm ring-1 ring-[#44a2de]/20 hover:bg-[#3991ca] hover:text-white"
                                  onMouseDown={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label={`View ${taskAssignee.name} details`}
                                  title={taskAssignee.name}
                                >
                                  {getEmployeeAvatarLetter(taskAssignee.name)}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-10 w-10 shrink-0 rounded-full border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                                  onMouseDown={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label="Assign project team member to task"
                                >
                                  <Users className="h-4 w-4" />
                                </Button>
                              )}
                            </PopoverTrigger>
                            <PopoverContent
                              align="end"
                              side="bottom"
                              sideOffset={8}
                              className="w-[280px] max-w-[calc(100vw-2rem)] border-slate-200 bg-white p-2 text-slate-900 shadow-lg"
                              onOpenAutoFocus={(event) => event.preventDefault()}
                            >
                              <TaskAssigneePopoverContent
                                task={task}
                                taskAssignee={taskAssignee}
                                employeeAssignments={employeeAssignments}
                                assigningTaskId={assigningTaskId}
                                onAssignEmployeeToTask={onAssignEmployeeToTask}
                                onOpenTaskEmployeeProfile={onOpenTaskEmployeeProfile}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
