"use client";

import { Check, Mail, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getEmployeeAvatarLetter,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import type { ProjectTask } from "@/lib/project-task-utils";

interface TaskAssigneePopoverContentProps {
  task: ProjectTask;
  taskAssignee: TeamPerson | null;
  employeeAssignments: TeamPerson[];
  assigningTaskId: string | null;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
}

export function TaskAssigneePopoverContent({
  task,
  taskAssignee,
  employeeAssignments,
  assigningTaskId,
  onAssignEmployeeToTask,
  onOpenTaskEmployeeProfile,
}: TaskAssigneePopoverContentProps) {
  if (taskAssignee) {
    return (
      <div className="space-y-3 p-2">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#c89212] text-[28px] font-medium text-white">
              {getEmployeeAvatarLetter(taskAssignee.name)}
            </div>
            <span
              className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                taskAssignee.isActive === false ? "bg-slate-300" : "bg-emerald-500"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-slate-900">{taskAssignee.name}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[13px]">
              <Mail className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
              <span className="min-w-0 break-all leading-tight text-cyan-600">
                {taskAssignee.email || "No email address"}
              </span>
            </div>
          </div>
        </div>
        <div className={`grid gap-2 ${taskAssignee.email ? "grid-cols-2" : "grid-cols-1"}`}>
          {taskAssignee.email ? (
            <Button
              asChild
              type="button"
              className="h-9 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
            >
              <a href={`mailto:${taskAssignee.email}`}>Send message</a>
            </Button>
          ) : null}
          <Button
            type="button"
            className="h-9 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-[12px] font-semibold text-slate-800 hover:bg-slate-200"
            onClick={() => onOpenTaskEmployeeProfile(task, taskAssignee)}
          >
            View Details
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="px-2 pb-2 pt-1">
        <p className="text-sm font-semibold text-slate-900">Assign Project Team</p>
        <p className="mt-1 text-xs text-slate-500">{task.title}</p>
      </div>
      <div className="max-h-[220px] space-y-1 overflow-y-auto">
        <button
          type="button"
          onClick={() => {
            void onAssignEmployeeToTask(task, "unassigned");
          }}
          disabled={assigningTaskId === task.id}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500">
            <Users className="h-4 w-4" />
          </span>
          <span className="flex-1">Unassigned</span>
          {!task.employeeAssigneeId && !task.assigneeId ? (
            <Check className="h-4 w-4 text-emerald-600" />
          ) : null}
        </button>
        {employeeAssignments.length === 0 ? (
          <p className="px-2 py-3 text-sm text-slate-500">No team members are assigned to this project yet.</p>
        ) : (
          employeeAssignments.map((employee) => {
            const isSelected = employee.id === (task.employeeAssigneeId || task.assigneeId);

            return (
              <button
                key={`${task.id}-${employee.id}`}
                type="button"
                onClick={() => {
                  void onAssignEmployeeToTask(task, employee.id);
                }}
                disabled={assigningTaskId === task.id}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#44a2de] text-sm font-semibold text-white">
                  {employee.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{employee.name}</span>
                  <span className="block truncate text-xs text-slate-500">{employee.email}</span>
                </span>
                {assigningTaskId === task.id ? (
                  <span className="text-xs text-slate-400">...</span>
                ) : isSelected ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
