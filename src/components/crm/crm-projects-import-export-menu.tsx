"use client";

import { useState } from "react";
import { Download, Settings, Upload } from "lucide-react";
import { CrmProjectsImportDialog } from "@/components/crm/crm-projects-import-dialog";
import {
  downloadCrmProjectsExportFile,
  type CrmProjectExportItem,
} from "@/components/crm/crm-projects-import-export-helpers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface CrmProjectsImportExportMenuProps {
  items: CrmProjectExportItem[];
  canImport?: boolean;
}

export function CrmProjectsImportExportMenu({
  items,
  canImport = false,
}: CrmProjectsImportExportMenuProps) {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  const handleExport = () => {
    if (items.length === 0) {
      toast.error("No CRM projects available to export");
      return;
    }

    downloadCrmProjectsExportFile(items);
    toast.success("CRM projects exported successfully");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded p-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
            aria-label="CRM project settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {canImport ? (
            <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import records
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export records
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CrmProjectsImportDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen} />
    </>
  );
}
