"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { createTimeEntry, updateTimeEntry } from "@/actions/time-entry.actions";
import type {
  WorkTrackingEmployeeOption,
  WorkTrackingProjectOption,
  WorkTrackingTaskOption,
} from "@/actions/time-entry.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type TimeEntryStatus = "DRAFT" | "SUBMITTED" | "APPROVED";

interface TimeEntryFormProps {
  entry?: {
    id: string;
    userId: string;
    projectId: string;
    taskId: string | null;
    date: Date;
    hours: number;
    description: string | null;
    isBillable: boolean;
    status: TimeEntryStatus;
  };
  projects: WorkTrackingProjectOption[];
  tasks: WorkTrackingTaskOption[];
  employees: WorkTrackingEmployeeOption[];
  currentUserId: string;
  currentUserName: string;
  canManageOthers: boolean;
}

function getActionErrorMessage(error: unknown) {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    return Object.values(error)
      .flat()
      .filter(Boolean)
      .join(", ");
  }
  return "Something went wrong";
}

export function TimeEntryForm({
  entry,
  projects,
  tasks,
  employees,
  currentUserId,
  currentUserName,
  canManageOthers,
}: TimeEntryFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isBillable, setIsBillable] = useState(entry?.isBillable ?? true);
  const [projectId, setProjectId] = useState(entry?.projectId ?? "");
  const [taskId, setTaskId] = useState(entry?.taskId ?? "");
  const [employeeId, setEmployeeId] = useState(entry?.userId ?? currentUserId);
  const router = useRouter();
  const isEditing = !!entry;

  const selectedProject = projects.find((project) => project.id === projectId);
  const taskOptions = useMemo(
    () => tasks.filter((task) => task.projectId === projectId),
    [projectId, tasks]
  );
  const selectedTask = tasks.find((task) => task.id === taskId && task.projectId === projectId);
  const employeeOptions = useMemo(() => {
    if (!canManageOthers) {
      return [{ id: currentUserId, name: currentUserName, role: "EMPLOYEE" }];
    }

    if (!selectedProject) {
      return employees;
    }

    const allowedIds = new Set(selectedProject.memberIds);
    for (const assigneeId of selectedTask?.assigneeIds ?? []) {
      allowedIds.add(assigneeId);
    }
    const filtered = employees.filter((employee) => allowedIds.has(employee.id));
    return filtered.length > 0 ? filtered : employees;
  }, [canManageOthers, currentUserId, currentUserName, employees, selectedProject, selectedTask]);

  const effectiveTaskId = taskOptions.some((task) => task.id === taskId) ? taskId : "";
  const effectiveEmployeeId = employeeOptions.some((employee) => employee.id === employeeId)
    ? employeeId
    : employeeOptions[0]?.id ?? currentUserId;

  async function handleSubmit(formData: FormData) {
    formData.set("isBillable", isBillable.toString());
    formData.set("employeeId", canManageOthers ? effectiveEmployeeId : currentUserId);
    formData.set("taskId", effectiveTaskId);

    startTransition(async () => {
      const result = isEditing
        ? await updateTimeEntry(entry.id, formData)
        : await createTimeEntry(formData);

      if (result.error) {
        toast.error(getActionErrorMessage(result.error));
      } else {
        toast.success(isEditing ? "Time entry updated" : "Time entry logged");
        router.push("/work-tracking");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Time Entry" : "Log Time"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee *</Label>
              {canManageOthers ? (
                <Select name="employeeId" value={effectiveEmployeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <>
                  <Input value={currentUserName} disabled />
                  <input type="hidden" name="employeeId" value={currentUserId} />
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Project *</Label>
              <Select
                name="projectId"
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value);
                  setTaskId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} ({project.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Task *</Label>
              <Select name="taskId" value={effectiveTaskId} onValueChange={setTaskId} disabled={!projectId}>
                <SelectTrigger>
                  <SelectValue placeholder={projectId ? "Select task" : "Select project first"} />
                </SelectTrigger>
                <SelectContent>
                  {taskOptions.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={
                  entry?.date
                    ? format(new Date(entry.date), "yyyy-MM-dd")
                    : format(new Date(), "yyyy-MM-dd")
                }
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Hours *</Label>
              <Input
                id="hours"
                name="hours"
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                defaultValue={entry?.hours || ""}
                placeholder="e.g., 2.5"
                required
                disabled={isPending}
              />
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="status" defaultValue={entry.status}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="SUBMITTED">Submitted</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <input type="hidden" name="status" value="DRAFT" />
            )}

            <div className="flex items-end">
              <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3">
                <Checkbox
                  id="isBillable"
                  checked={isBillable}
                  onCheckedChange={(checked) => setIsBillable(checked === true)}
                  disabled={isPending}
                />
                <Label htmlFor="isBillable" className="cursor-pointer">
                  Billable hours
                </Label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={entry?.description || ""}
                placeholder="What did you work on?"
                disabled={isPending}
                rows={3}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending || !projectId || !effectiveTaskId}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Entry" : "Log Time"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
