import type { DragEvent } from "react";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskPriorityLabel,
  getTaskPriorityLevel,
  getTaskStatus,
} from "@/lib/project-task-utils";
import type { EmployeeTaskStage } from "./employee-task-list-shared";

const STAGE_THEMES = [
  "border-cyan-200 bg-cyan-50/60",
  "border-blue-200 bg-blue-50/60",
  "border-amber-200 bg-amber-50/60",
  "border-emerald-200 bg-emerald-50/60",
  "border-rose-200 bg-rose-50/60",
] as const;

interface EmployeeTaskBoardProps {
  dragOverStageId: string | null;
  draggingTaskId: string | null;
  getAssignedTlName: (task: ProjectTask) => string;
  groupedTasks: Record<string, ProjectTask[]>;
  onDragEnd: () => void;
  onDragLeaveStage: (stageId: string) => void;
  onDragOverStage: (stageId: string, event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (taskId: string, event: DragEvent<HTMLDivElement>) => void;
  onDropStage: (stageId: string, event: DragEvent<HTMLDivElement>, taskId: string | null) => void;
  onOpenTask: (task: ProjectTask) => void;
  stages: EmployeeTaskStage[];
}

export function EmployeeTaskBoard({
  dragOverStageId,
  draggingTaskId,
  getAssignedTlName,
  groupedTasks,
  onDragEnd,
  onDragLeaveStage,
  onDragOverStage,
  onDragStart,
  onDropStage,
  onOpenTask,
  stages,
}: EmployeeTaskBoardProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[960px] gap-5">
        {stages.map((stage, stageIndex) => (
          <div
            key={stage.id}
            className={`w-full min-w-[320px] transition-colors ${
              dragOverStageId === stage.id ? "opacity-90" : ""
            }`}
            onDragOver={(event) => onDragOverStage(stage.id, event)}
            onDragLeave={() => onDragLeaveStage(stage.id)}
            onDrop={(event) => onDropStage(stage.id, event, draggingTaskId)}
          >
            <div className={`border ${STAGE_THEMES[stageIndex % STAGE_THEMES.length]}`}>
              <div className="flex items-center justify-between border-b border-slate-300/80 px-4 py-3">
                <p className="text-2xl font-semibold tracking-tight text-slate-900">{stage.name}</p>
                <Badge
                  variant="secondary"
                  className="h-7 min-w-7 rounded-full bg-slate-200 px-2 text-sm font-semibold text-slate-700"
                >
                  {groupedTasks[stage.id]?.length ?? 0}
                </Badge>
              </div>

              {(groupedTasks[stage.id]?.length ?? 0) === 0 ? (
                <div className="border-t border-dashed border-slate-300/80 px-4 py-6 text-center text-sm text-slate-600">
                  No tasks
                </div>
              ) : (
                <div className="bg-white">
                  {groupedTasks[stage.id].map((task, taskIndex) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(event) => onDragStart(task.id, event)}
                      onDragEnd={onDragEnd}
                      className={`cursor-grab bg-white px-4 py-3 transition hover:bg-slate-50 active:cursor-grabbing ${
                        taskIndex < groupedTasks[stage.id].length - 1 ? "border-b border-slate-300/90" : ""
                      }`}
                    >
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-slate-900 hover:underline"
                        onClick={() => onOpenTask(task)}
                      >
                        {task.title}
                      </button>
                      <div className="mt-3 space-y-1 text-sm text-slate-700">
                        <p>
                          Assigned TL: <span className="font-medium">{getAssignedTlName(task)}</span>
                        </p>
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
                      <div className="mt-2 flex items-center gap-1 text-amber-500">
                        {Array.from({ length: getTaskPriorityLevel(task) }).map((_, index) => (
                          <Star key={`${task.id}-priority-${index}`} className="h-4 w-4 fill-current" />
                        ))}
                        <span className="ml-1 text-xs font-medium text-slate-600">
                          {getTaskPriorityLabel(task)}
                        </span>
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
  );
}

