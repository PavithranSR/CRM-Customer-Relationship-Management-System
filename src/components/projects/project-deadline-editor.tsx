"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { updateProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ProjectDeadlineEditorProps {
  projectId: string;
  deadline: Date | string | null;
  canEdit: boolean;
}

function toDateInputValue(value: Date | string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "yyyy-MM-dd");
}

export function ProjectDeadlineEditor({ projectId, deadline, canEdit }: ProjectDeadlineEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState(() => toDateInputValue(deadline));

  useEffect(() => {
    setDeadlineValue(toDateInputValue(deadline));
  }, [deadline]);

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
      formData.set("deadline", deadlineValue);

      const result = await updateProject(projectId, formData);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to update deadline");
        return;
      }

      toast.success("Deadline updated successfully");
      setIsEditing(false);
      router.refresh();
    });
  };

  if (!canEdit) {
    return <span>{deadlineValue ? displayValue : "Not set"}</span>;
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
              setDeadlineValue(toDateInputValue(deadline));
              setIsEditing(false);
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="font-medium text-slate-900">{displayValue}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsEditing(true)}
            className="pointer-events-none shrink-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            aria-label="Edit deadline"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
