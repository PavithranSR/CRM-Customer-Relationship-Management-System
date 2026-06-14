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

interface StoredLeadConfirmDialogProps {
  confirmState: { id: string; action: "restore" | "delete" } | null;
  kind: "archive" | "deleted";
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
}

export function StoredLeadConfirmDialog({
  confirmState,
  kind,
  onConfirm,
  onOpenChange,
  pending,
}: StoredLeadConfirmDialogProps) {
  return (
    <AlertDialog open={!!confirmState} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmState?.action === "delete"
              ? "Delete lead permanently?"
              : kind === "archive"
                ? "Restore archived lead?"
                : "Restore deleted lead?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">
              {confirmState?.action === "delete"
                ? "This action will permanently delete the selected lead details."
                : "This action will restore the selected lead details back to the CRM page."}
            </span>
            <span className="mt-1 block">
              {confirmState?.action === "delete"
                ? "Please confirm to continue with deletion."
                : "Please confirm to continue with restore."}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className={confirmState?.action === "delete" ? "bg-red-600 hover:bg-red-700" : ""}
            disabled={pending}
          >
            {pending
              ? confirmState?.action === "delete"
                ? "Deleting..."
                : "Restoring..."
              : confirmState?.action === "delete"
                ? "Confirm Delete"
                : "Confirm Restore"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

