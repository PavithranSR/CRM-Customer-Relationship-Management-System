"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { getProjectTasks } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectTask, getTaskCompletionPercent, getTaskStatus, normalizeTask } from "@/lib/project-task-utils";
import { TaskComments } from "@/components/projects/task-comments";

interface TaskProgressOverviewProps {
  projectId: string;
  assignees: { id: string; name: string; email: string; role: string }[];
  title?: string;
}

export function TaskProgressOverview({
  projectId,
  assignees,
  title = "Task Progress Overview",
}: TaskProgressOverviewProps) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  const assigneeMap = useMemo(
    () => new Map(assignees.map((person) => [person.id, person])),
    [assignees]
  );

  useEffect(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        setTasks([]);
        return;
      }
      setTasks(
        result.data
          .map(normalizeTask)
          .filter((item): item is ProjectTask => Boolean(item))
      );
    });
  }, [projectId]);

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks created by team leader yet.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const assignee = assigneeMap.get(task.assigneeId);
              return (
                <div key={task.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{task.assigneeId ? assignee?.name ?? "Unknown employee" : "Unassigned"}</Badge>
                      <Badge variant="secondary">{getTaskCompletionPercent(task)}%</Badge>
                      <Badge variant="outline">{getTaskStatus(task)}</Badge>
                    </div>
                  </div>
                  {task.description ? (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Employee Daily Updates</p>
                    {task.updates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No updates yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {task.updates.slice().reverse().map((update) => {
                          const updater = assigneeMap.get(update.byUserId);
                          return (
                            <div key={update.id} className="rounded border p-2 text-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span>
                                  {updater?.name ?? "Employee"} | {format(new Date(update.createdAt), "MMM d, yyyy")}
                                </span>
                                <Badge variant="outline">Update</Badge>
                              </div>
                              <p className="mt-1 text-muted-foreground">{update.comment || "No comment"}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <TaskComments projectId={projectId} taskId={task.id} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
