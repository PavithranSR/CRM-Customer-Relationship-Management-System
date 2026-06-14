"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeAssigneeInput } from "@/components/projects/admin-project-task-monitor-parts/employee-assignee-input";
import { type TaskStageItem, type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";

interface TaskComposerDialogProps {
  editingTaskId: string | null;
  employeeAssignments: TeamPerson[];
  isSavingTask: boolean;
  projectId: string;
  onAddTask: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onResetTaskDialog: () => void;
  onClearTaskAssignee: () => void;
  onSelectTaskAssignee: (employee: TeamPerson) => void;
  onTaskAssigneeQueryChange: (value: string) => void;
  open: boolean;
  stages: TaskStageItem[];
  taskAssigneeQuery: string;
  taskDescription: string;
  taskDueDate: string;
  taskPriority: string;
  taskStageId: string;
  taskTitle: string;
  setTaskDescription: (value: string) => void;
  setTaskDueDate: (value: string) => void;
  setTaskPriority: (value: string) => void;
  setTaskStageId: (value: string) => void;
  setTaskTitle: (value: string) => void;
}

export function TaskComposerDialog({
  editingTaskId,
  employeeAssignments,
  isSavingTask,
  projectId,
  onAddTask,
  onOpenChange,
  onResetTaskDialog,
  onClearTaskAssignee,
  onSelectTaskAssignee,
  onTaskAssigneeQueryChange,
  open,
  stages,
  taskAssigneeQuery,
  taskDescription,
  taskDueDate,
  taskPriority,
  taskStageId,
  taskTitle,
  setTaskDescription,
  setTaskDueDate,
  setTaskPriority,
  setTaskStageId,
  setTaskTitle,
}: TaskComposerDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onResetTaskDialog();
          return;
        }

        onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTaskId ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-task-title">Task Title</Label>
            <Input
              id="admin-task-title"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Enter task title"
              disabled={isSavingTask}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-task-description">Description</Label>
            <Textarea
              id="admin-task-description"
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              placeholder="Add task details"
              rows={4}
              disabled={isSavingTask}
            />
          </div>
          <div className="space-y-2">
            <Label>Assign Project Team (optional)</Label>
            <EmployeeAssigneeInput
              inputId="admin-task-assignee"
              projectId={projectId}
              employees={employeeAssignments}
              value={taskAssigneeQuery}
              onValueChange={onTaskAssigneeQueryChange}
              onEmployeePick={onSelectTaskAssignee}
              onClearSelection={onClearTaskAssignee}
              placeholder="Type team member name or email"
              disabled={isSavingTask}
            />
            {employeeAssignments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No team members are assigned to this project yet.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Only team members assigned to this project can be selected.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-task-due-date">Deadline</Label>
            <Input
              id="admin-task-due-date"
              type="date"
              value={taskDueDate}
              onChange={(event) => setTaskDueDate(event.target.value)}
              disabled={isSavingTask}
            />
          </div>
          <div className="space-y-2">
            <Label>Stage</Label>
            <Select value={taskStageId} onValueChange={setTaskStageId} disabled={isSavingTask}>
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
            <Select value={taskPriority} onValueChange={setTaskPriority} disabled={isSavingTask}>
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
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onResetTaskDialog} disabled={isSavingTask}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onAddTask()} disabled={isSavingTask}>
            {isSavingTask ? (editingTaskId ? "Saving..." : "Creating...") : editingTaskId ? "Save Changes" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
