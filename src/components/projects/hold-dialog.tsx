"use client";

import { useTransition } from "react";
import { holdProject, restartProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface HoldDialogProps {
  projectId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HoldDialog({ projectId, open, onOpenChange }: HoldDialogProps) {
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    if (!projectId) return;

    startTransition(async () => {
      const result = await holdProject(projectId, formData);
      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success("Project put on hold");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Put Project on Hold</DialogTitle>
          <DialogDescription>
            Please provide a reason for putting this project on hold.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                name="reason"
                placeholder="e.g., Waiting for client feedback, Resource constraints..."
                required
                disabled={isPending}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Put on Hold
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RestartDialogProps {
  projectId: string | null;
  holdReason: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RestartDialog({ projectId, holdReason, open, onOpenChange }: RestartDialogProps) {
  const [isPending, startTransition] = useTransition();

  async function handleRestart() {
    if (!projectId) return;

    startTransition(async () => {
      const result = await restartProject(projectId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project restarted successfully");
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restart Project</DialogTitle>
          <DialogDescription>
            This project is currently on hold. Would you like to restart it?
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {holdReason && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Hold Reason:</p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{holdReason}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-4">
            The project deadline will be automatically extended by the number of days it was on hold.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleRestart} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Restart Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
