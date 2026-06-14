"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { updateProjectTask } from "@/actions/project-task.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectTask } from "@/lib/project-task-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProjectTaskDeadlineEditorProps {
  projectId: string;
  task: Pick<
    ProjectTask,
    "id" | "title" | "description" | "assigneeId" | "employeeAssigneeId" | "priority" | "stageId" | "dueDate"
  >;
  canEdit: boolean;
  onUpdated?: (dueDate: string | undefined) => void;
  valueClassName?: string;
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
}

function toStoredDueDate(value: string) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

export function ProjectTaskDeadlineEditor({
  projectId,
  task,
  canEdit,
  onUpdated,
  valueClassName,
}: ProjectTaskDeadlineEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(() => toDateInputValue(task.dueDate));

  const displayValue = useMemo(() => {
    if (!deadlineValue) {
      return "Not set";
    }

    const parsed = new Date(deadlineValue);
    return Number.isNaN(parsed.getTime()) ? "Not set" : format(parsed, "MMM d, yyyy");
  }, [deadlineValue]);

  const handleSave = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("taskId", task.id);
      formData.set("title", task.title);
      formData.set("description", task.description ?? "");
      formData.set(
        "assigneeId",
        task.employeeAssigneeId?.trim() || task.assigneeId?.trim() || ""
      );
      formData.set("priority", String(task.priority ?? 1));
      if (task.stageId) {
        formData.set("stageId", task.stageId);
      }
      formData.set("dueDate", deadlineValue);

      const result = await updateProjectTask(formData);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to update deadline");
        return;
      }

      onUpdated?.(toStoredDueDate(deadlineValue));
      toast.success("Deadline updated successfully");
      setIsEditing(false);
      router.refresh();
    });
  };

  if (!canEdit) {
    return <span className={cn("font-medium text-slate-900", valueClassName)}>{displayValue}</span>;
  }

  return (
    <div className="group flex flex-wrap items-center gap-2">
      {isEditing ? (
        <>
          <Input
            type="date"
            value={deadlineValue}
            onChange={(event) => setDeadlineValue(event.target.value)}
            disabled={isPending}
            className="w-auto min-w-[180px]"
          />
          <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setDeadlineValue(toDateInputValue(task.dueDate));
              setIsEditing(false);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className={cn("font-medium text-slate-900", valueClassName)}>{displayValue}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            className="pointer-events-none shrink-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            aria-label="Edit task deadline"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
