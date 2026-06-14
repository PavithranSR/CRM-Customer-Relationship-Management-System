import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ProjectTask, getTaskCompletionPercent, getTaskStatus } from "@/lib/project-task-utils";
import type { EmployeeTaskStage } from "./employee-task-list-shared";

interface EmployeeTaskDetailDialogProps {
  dailyComment: string;
  getAssignedTlName: (task: ProjectTask) => string;
  getStageLabel: (task: ProjectTask) => string;
  onCommentChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelectedStageChange: (value: string) => void;
  onSubmitDailyUpdate: (taskId: string) => void;
  onUpdateStage: (taskId: string) => void;
  open: boolean;
  selectedStageId: string;
  selectedTask: ProjectTask | null;
  stages: EmployeeTaskStage[];
}

export function EmployeeTaskDetailDialog({
  dailyComment,
  getAssignedTlName,
  getStageLabel,
  onCommentChange,
  onOpenChange,
  onSelectedStageChange,
  onSubmitDailyUpdate,
  onUpdateStage,
  open,
  selectedStageId,
  selectedTask,
  stages,
}: EmployeeTaskDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
        </DialogHeader>

        {selectedTask ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">Task Details</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Task Name</p>
                    <p className="font-semibold">{selectedTask.title}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Status</p>
                    <Badge variant="outline">{getTaskStatus(selectedTask)}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Task Stage</p>
                    <p className="font-medium">{getStageLabel(selectedTask)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Assigned TL Name</p>
                    <p className="font-medium">{getAssignedTlName(selectedTask)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {selectedTask.dueDate ? format(new Date(selectedTask.dueDate), "MMM d, yyyy") : "-"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Task Description</p>
                  <p className="mt-1 text-sm">{selectedTask.description || "-"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Work Update</p>
                  <div className="space-y-2">
                    <Label htmlFor={`comment-${selectedTask.id}`}>Comment</Label>
                    <Textarea
                      id={`comment-${selectedTask.id}`}
                      value={dailyComment}
                      onChange={(event) => onCommentChange(event.target.value)}
                      placeholder="Write your daily update"
                      rows={3}
                    />
                  </div>
                  <Button type="button" onClick={() => onSubmitDailyUpdate(selectedTask.id)}>
                    Save Update
                  </Button>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm font-medium">Progress Tracking</p>
                  <div className="flex items-center gap-2">
                    <Progress value={getTaskCompletionPercent(selectedTask)} className="h-2" />
                    <span className="text-sm font-medium">{getTaskCompletionPercent(selectedTask)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Progress is visible to you, assigned TL, project BA, and Admin.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Change Task Stage</p>
              <Select value={selectedStageId} onValueChange={onSelectedStageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={() => onUpdateStage(selectedTask.id)}>
                Update Stage
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

