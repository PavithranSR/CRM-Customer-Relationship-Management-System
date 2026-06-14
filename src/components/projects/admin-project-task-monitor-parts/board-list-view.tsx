"use client";

import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ProjectTask } from "@/lib/project-task-utils";

interface BoardListViewProps {
  filteredTasks: ProjectTask[];
  hasTaskFilteringCriteria: boolean;
  onStartEditTask: (task: ProjectTask) => void;
  onOpenTask: (taskId: string) => void;
  getResponsibleName: (task: ProjectTask) => string;
  getStageName: (task: ProjectTask) => string;
  getTaskStatus: (task: ProjectTask) => string;
}

export function BoardListView({
  filteredTasks,
  hasTaskFilteringCriteria,
  onStartEditTask,
  onOpenTask,
  getResponsibleName,
  getStageName,
  getTaskStatus,
}: BoardListViewProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-4 py-3 font-semibold text-slate-700">Task</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Stage</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Responsible Person</th>
                <th className="px-4 py-3 font-semibold text-slate-700">Due Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    {hasTaskFilteringCriteria ? "No tasks match the selected filters." : "No tasks yet."}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="border-b last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          className="flex min-w-0 items-center gap-2 text-left text-slate-900 hover:underline"
                          onClick={() => onOpenTask(task.id)}
                        >
                          <span className="min-w-0 truncate">{task.title}</span>
                        </button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onStartEditTask(task)}
                          aria-label="Edit task"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStageName(task)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{getTaskStatus(task)}</Badge>
                    </td>
                    <td className="px-4 py-3">{getResponsibleName(task)}</td>
                    <td className="px-4 py-3">
                      {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
