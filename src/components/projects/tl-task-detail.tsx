"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { reassignProjectTask } from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectTaskDeadlineEditor } from "@/components/projects/project-task-deadline-editor";
import { getTaskStatus, type ProjectTask } from "@/lib/project-task-utils";
import { toast } from "sonner";

interface EmployeeOption {
  id: string;
  name: string;
  email: string;
}

interface TlTaskDetailProps {
  projectId: string;
  task: ProjectTask;
  stageName: string;
  employees: EmployeeOption[];
  canEditDeadline: boolean;
  canAssignEmployee: boolean;
}

export function TlTaskDetail({
  projectId,
  task,
  stageName,
  employees,
  canEditDeadline,
  canAssignEmployee,
}: TlTaskDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [showAssignSection, setShowAssignSection] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const router = useRouter();

  const handleAssign = () => {
    if (!selectedEmployeeId) {
      toast.error("Select an employee");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("taskId", task.id);
    formData.append("employeeId", selectedEmployeeId);

    startTransition(async () => {
      const result = await reassignProjectTask(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Task assigned to employee");
      router.push(`/projects/${projectId}?view=kanban`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Task Name</p>
            <p className="font-semibold">{task.title}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Description</p>
            <p>{task.description || "-"}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="secondary">{getTaskStatus(task)}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stage</p>
              <p className="font-medium">{stageName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Deadline</p>
              <ProjectTaskDeadlineEditor
                key={`${task.id}-${task.dueDate ?? "none"}`}
                projectId={projectId}
                task={task}
                canEdit={canEditDeadline}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{format(new Date(task.createdAt), "MMM d, yyyy")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {canAssignEmployee ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Assign Employee</CardTitle>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAssignSection((current) => !current)}
            >
              {showAssignSection ? "Close" : "Assign Employee"}
            </Button>
          </CardHeader>
          {showAssignSection && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Employee</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No project employees available
                      </SelectItem>
                    ) : (
                      employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name} ({employee.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={handleAssign} disabled={isPending || !selectedEmployeeId}>
                  Assign
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedEmployeeId("");
                    setShowAssignSection(false);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      ) : null}
    </div>
  );
}
