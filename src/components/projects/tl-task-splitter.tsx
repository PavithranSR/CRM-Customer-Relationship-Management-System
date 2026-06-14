"use client";

import { useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { format } from "date-fns";
import { Star } from "lucide-react";
import { createProjectTask, getProjectTasks } from "@/actions/project-task.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ProjectTask,
  getTaskCompletionPercent,
  getTaskPriorityLabel,
  getTaskPriorityLevel,
  getTaskStatus,
  normalizeTask,
} from "@/lib/project-task-utils";
import { TaskComments } from "@/components/projects/task-comments";

interface AssignmentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface TlTaskSplitterProps {
  projectId: string;
  assignments: { user: AssignmentUser }[];
}

export function TlTaskSplitter({ projectId, assignments }: TlTaskSplitterProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState("1");
  const [tasks, setTasks] = useState<ProjectTask[]>([]);

  const employees = useMemo(
    () =>
      assignments
        .map((assignment) => assignment.user)
        .filter((user) => user.role === "EMPLOYEE"),
    [assignments]
  );

  const employeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  useEffect(() => {
    getProjectTasks(projectId).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const normalized = result.data
        .map(normalizeTask)
        .filter((item): item is ProjectTask => Boolean(item));
      setTasks(normalized);
    });
  }, [projectId]);

  const addTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }
    if (!assigneeId) {
      toast.error("Select an employee");
      return;
    }
    if (!employeeMap.has(assigneeId)) {
      toast.error("You can assign tasks only to your team employees");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("title", trimmedTitle);
    formData.append("description", description.trim());
    formData.append("assigneeId", assigneeId);
    formData.append("priority", priority);

    createProjectTask(formData).then((result) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTasks((result.data ?? []).map(normalizeTask).filter((item): item is ProjectTask => Boolean(item)));
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("1");
      toast.success("Task created");
    });
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Team Leader Task Split</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border p-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="taskTitle">Task Title</Label>
            <Input
              id="taskTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Build landing page section"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="taskDescription">Task Description</Label>
            <Textarea
              id="taskDescription"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Task details"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Assign Employee (Your Team Only)</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No team employees assigned to this project
                  </SelectItem>
                ) : (
                  employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Star = Medium</SelectItem>
                <SelectItem value="2">2 Stars = High</SelectItem>
                <SelectItem value="3">3 Stars = Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={addTask}>
            Create Task
          </Button>
        </div>

        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks created yet.</p>
          ) : (
            tasks.map((task) => {
              const assignee = employeeMap.get(task.assigneeId);
              const completion = getTaskCompletionPercent(task);
              const status = getTaskStatus(task);
              return (
                <div key={task.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{task.title}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{assignee?.name ?? "Unknown employee"}</Badge>
                      <Badge variant="secondary">{completion}%</Badge>
                      <Badge variant="outline">{status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500">
                    {Array.from({ length: getTaskPriorityLevel(task) }).map((_, index) => (
                      <Star key={`${task.id}-priority-${index}`} className="h-4 w-4 fill-current" />
                    ))}
                    <span className="ml-1 text-xs font-medium text-slate-600">
                      {getTaskPriorityLabel(task)}
                    </span>
                  </div>
                  {task.description ? (
                    <p className="text-sm text-muted-foreground">{task.description}</p>
                  ) : null}

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Daily Updates</p>
                    {task.updates.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No updates from employee yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {task.updates.slice().reverse().map((update) => (
                          <div key={update.id} className="rounded border p-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span>{format(new Date(update.createdAt), "MMM d, yyyy")}</span>
                              <Badge variant="outline">Update</Badge>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {update.comment || "No comment"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <TaskComments projectId={projectId} taskId={task.id} />
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
