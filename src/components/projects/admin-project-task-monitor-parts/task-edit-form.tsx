"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProjectTask } from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeAssigneeInput } from "@/components/projects/admin-project-task-monitor-parts/employee-assignee-input";
import {
  findEmployeeByQuery,
  getEmployeeOptionLabel,
  type TaskStageItem,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import { getTaskPriorityLevel, type ProjectTask } from "@/lib/project-task-utils";

interface TaskEditFormProps {
  backHref: string;
  employeeAssignments: TeamPerson[];
  projectId: string;
  stages: TaskStageItem[];
  task: ProjectTask;
}

export function TaskEditForm({
  backHref,
  employeeAssignments,
  projectId,
  stages,
  task,
}: TaskEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [taskTitle, setTaskTitle] = useState(task.title);
  const [taskDescription, setTaskDescription] = useState(task.description ?? "");
  const [taskAssigneeQuery, setTaskAssigneeQuery] = useState(() => {
    const match = employeeAssignments.find(
      (employee) => employee.id === (task.employeeAssigneeId || task.assigneeId)
    );
    return match ? getEmployeeOptionLabel(match) : "";
  });
  const [taskStageId, setTaskStageId] = useState(task.stageId || stages[0]?.id || "");
  const [taskDueDate, setTaskDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [taskPriority, setTaskPriority] = useState(String(getTaskPriorityLevel(task)));

  const currentAssignee = useMemo(
    () => findEmployeeByQuery(employeeAssignments, taskAssigneeQuery) ?? null,
    [employeeAssignments, taskAssigneeQuery]
  );

  const handleSave = () => {
    const trimmedTitle = taskTitle.trim();
    const trimmedAssigneeQuery = taskAssigneeQuery.trim();

    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }

    if (trimmedAssigneeQuery && !currentAssignee) {
      toast.error("Please select an employee from the list or leave it blank");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);
    formData.append("title", trimmedTitle);
    formData.append("description", taskDescription.trim());
    formData.append("priority", taskPriority);
    if (currentAssignee) {
      formData.append("assigneeId", currentAssignee.id);
    }
    if (taskStageId) {
      formData.append("stageId", taskStageId);
    }
    if (taskDueDate) {
      formData.append("dueDate", taskDueDate);
    }

    startTransition(async () => {
      const result = await updateProjectTask(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Task updated");
      router.push(backHref);
      router.refresh();
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle className="text-xl">Edit Task</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="task-title">Task Title</Label>
          <Input
            id="task-title"
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-description">Description</Label>
          <Textarea
            id="task-description"
            value={taskDescription}
            onChange={(event) => setTaskDescription(event.target.value)}
            placeholder="Add task details"
            rows={4}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Assign Project Team (optional)</Label>
          <EmployeeAssigneeInput
            inputId="task-assignee"
            projectId={projectId}
            employees={employeeAssignments}
            value={taskAssigneeQuery}
            onValueChange={setTaskAssigneeQuery}
            onEmployeePick={(employee) => setTaskAssigneeQuery(getEmployeeOptionLabel(employee))}
            onClearSelection={() => setTaskAssigneeQuery("")}
            placeholder="Type team member name or email"
            disabled={isPending}
          />
          {employeeAssignments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No team members are assigned to this project yet.</p>
          ) : (
            <p className="text-xs text-muted-foreground">Only team members assigned to this project can be selected.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="task-due-date">Deadline</Label>
          <Input
            id="task-due-date"
            type="date"
            value={taskDueDate}
            onChange={(event) => setTaskDueDate(event.target.value)}
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label>Stage</Label>
          <Select value={taskStageId} onValueChange={setTaskStageId} disabled={isPending}>
            <SelectTrigger>
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={taskPriority} onValueChange={setTaskPriority} disabled={isPending}>
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

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
