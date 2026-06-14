"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import {
  getEmployeeOptionLabel,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import type { ProjectTask } from "@/lib/project-task-utils";

interface DetailSubtasksTabProps {
  isAddingSubtask: boolean;
  onAddSubtask: () => void;
  onResetSubtaskForm: () => void;
  onSetShowSubtaskForm: (value: boolean) => void;
  onSetSubtaskAssigneeId: (value: string) => void;
  onSetSubtaskTitle: (value: string) => void;
  peopleMap: Map<string, TeamPerson>;
  projectTeamMembers: TeamPerson[];
  selectedTask: ProjectTask;
  showSubtaskForm: boolean;
  subtaskAssigneeId: string;
  subtaskTitle: string;
}

export function DetailSubtasksTab({
  isAddingSubtask,
  onAddSubtask,
  onResetSubtaskForm,
  onSetShowSubtaskForm,
  onSetSubtaskAssigneeId,
  onSetSubtaskTitle,
  peopleMap,
  projectTeamMembers,
  selectedTask,
  showSubtaskForm,
  subtaskAssigneeId,
  subtaskTitle,
}: DetailSubtasksTabProps) {
  return (
    <TabsContent value="subtasks" className="mt-0 bg-white p-0">
      <div className="grid grid-cols-[1.3fr_0.7fr] border-b border-slate-200 px-6 py-4 text-sm font-semibold text-slate-700">
        <p>Title</p>
        <p>Assignees</p>
      </div>
      {selectedTask.subtasks?.map((subtask) => (
        <div key={subtask.id} className="grid grid-cols-[1.3fr_0.7fr] border-b border-slate-200 px-6 py-4 text-sm text-slate-700">
          <p>{subtask.title}</p>
          <p>{subtask.assigneeId ? peopleMap.get(subtask.assigneeId)?.name ?? "Unknown" : "Unassigned"}</p>
        </div>
      ))}
      {showSubtaskForm ? (
        <div className="grid grid-cols-[1.3fr_0.7fr] gap-3 border-b border-slate-200 px-6 py-4">
          <Input
            value={subtaskTitle}
            onChange={(event) => onSetSubtaskTitle(event.target.value)}
            placeholder="Enter sub-task title"
            disabled={isAddingSubtask}
            className="border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
          />
          <div className="flex items-center gap-2">
            <Select value={subtaskAssigneeId} onValueChange={onSetSubtaskAssigneeId} disabled={isAddingSubtask}>
              <SelectTrigger className="border-slate-300 bg-white text-slate-900">
                <SelectValue placeholder="Assign team member" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-900">
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {projectTeamMembers.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {getEmployeeOptionLabel(employee)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              className="shrink-0 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={onAddSubtask}
              disabled={isAddingSubtask}
              aria-label="Save sub-task"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              onClick={onResetSubtaskForm}
              disabled={isAddingSubtask}
              aria-label="Cancel sub-task"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className="w-full border-t border-slate-800 px-6 py-5 text-left text-base text-cyan-300 transition hover:bg-slate-800/40 hover:text-cyan-200"
        onClick={() => onSetShowSubtaskForm(true)}
      >
        Add a line
      </button>
      {(!selectedTask.subtasks || selectedTask.subtasks.length === 0) && !showSubtaskForm ? (
        <div className="border-t border-slate-800 px-6 py-6 text-sm text-slate-400">No sub-tasks added yet.</div>
      ) : null}
    </TabsContent>
  );
}
