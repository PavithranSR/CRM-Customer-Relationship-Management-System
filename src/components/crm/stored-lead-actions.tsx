import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface StoredLeadActionsProps {
  kind: "archive" | "deleted";
  onDelete?: () => void;
  onRestore: () => void;
}

export function StoredLeadActions({ kind, onRestore, onDelete }: StoredLeadActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onRestore}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Restore
        </DropdownMenuItem>
        {kind === "deleted" && onDelete ? (
          <DropdownMenuItem className="text-red-600 focus:text-red-700" onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Permanently
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

