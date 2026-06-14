import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AdminDeleteStageAlertProps {
  target: { id: string; name: string } | null;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}

export function AdminDeleteStageAlert({
  target,
  isSaving,
  onCancel,
  onConfirm,
}: AdminDeleteStageAlertProps) {
  return (
    <AlertDialog open={!!target} onOpenChange={() => onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete stage?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">
              This action will delete stage &quot;{target?.name || ""}&quot; and move its tasks.
            </span>
            <span className="mt-1 block">Please confirm to continue with deletion.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (target) {
                onConfirm(target.id);
              }
              onCancel();
            }}
            className="bg-red-600 hover:bg-red-700"
            disabled={isSaving}
          >
            {isSaving ? "Deleting..." : "Confirm Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
