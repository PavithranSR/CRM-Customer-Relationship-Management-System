"use client";

import { useState, useTransition } from "react";
import { restartProject, updateProjectProgress, updateProjectStatus } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, Play, Pause, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectStatus } from "@prisma/client";
import { HoldDialog } from "./hold-dialog";

interface ProjectActionsProps {
  project: {
    id: string;
    status: ProjectStatus;
    progress: number;
    holdReason: string | null;
  };
}

export function ProjectActions({ project }: ProjectActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showHoldDialog, setShowHoldDialog] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [progress, setProgress] = useState(project.progress);

  const handleStatusChange = (status: ProjectStatus) => {
    startTransition(async () => {
      const result = await updateProjectStatus(project.id, status);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project status updated");
      }
    });
  };

  const handleRestart = () => {
    startTransition(async () => {
      const result = await restartProject(project.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Project restarted");
        setShowRestartDialog(false);
      }
    });
  };

  const handleProgressUpdate = () => {
    startTransition(async () => {
      const result = await updateProjectProgress(project.id, progress);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Progress updated");
        setShowProgressDialog(false);
      }
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={isPending}>
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowProgressDialog(true)}>
            Update Progress
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {project.status === "ON_HOLD" && (
            <DropdownMenuItem onClick={() => setShowRestartDialog(true)}>
              <Play className="mr-2 h-4 w-4" />
              Restart Project
            </DropdownMenuItem>
          )}
          {project.status === "PLANNING" && (
            <DropdownMenuItem onClick={() => handleStatusChange("IN_PROGRESS")}>
              <Play className="mr-2 h-4 w-4" />
              Start Project
            </DropdownMenuItem>
          )}
          {project.status === "IN_PROGRESS" && (
            <DropdownMenuItem onClick={() => setShowHoldDialog(true)}>
              <Pause className="mr-2 h-4 w-4" />
              Put on Hold
            </DropdownMenuItem>
          )}
          {project.status !== "COMPLETED" && project.status !== "CANCELLED" && (
            <>
              <DropdownMenuItem onClick={() => handleStatusChange("COMPLETED")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Complete
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600"
                onClick={() => handleStatusChange("CANCELLED")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel Project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <HoldDialog
        projectId={project.id}
        open={showHoldDialog}
        onOpenChange={setShowHoldDialog}
      />

      {/* Restart Dialog */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart Project</DialogTitle>
            <DialogDescription>
              This project is currently on hold. Would you like to restart it?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {project.holdReason && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-md">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Hold Reason:</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{project.holdReason}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              The project deadline will be automatically extended by the number of days it was on hold.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestartDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleRestart} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restart Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
            <DialogDescription>
              Set the current progress percentage for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(Number(e.target.value))}
                disabled={isPending}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12">{progress}%</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProgressDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleProgressUpdate} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
