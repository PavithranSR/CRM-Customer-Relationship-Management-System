import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AdminAddStageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageName: string;
  onStageNameChange: (name: string) => void;
  isSaving: boolean;
  onCancel: () => void;
  onAdd: () => void;
}

export function AdminAddStageDialog({
  open,
  onOpenChange,
  stageName,
  onStageNameChange,
  isSaving,
  onCancel,
  onAdd,
}: AdminAddStageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Stage</DialogTitle>
        </DialogHeader>
        <Input
          value={stageName}
          onChange={(event) => onStageNameChange(event.target.value)}
          placeholder="Enter stage name"
          disabled={isSaving}
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onAdd} disabled={isSaving}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
