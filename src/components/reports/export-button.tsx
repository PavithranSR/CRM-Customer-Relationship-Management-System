"use client";

import { useTransition } from "react";
import { exportReportCSV } from "@/actions/report.actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  startDate: Date;
  endDate: Date;
}

export function ExportButton({ startDate, endDate }: ExportButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleExport = (type: "employee-hours" | "project-hours" | "detailed") => {
    startTransition(async () => {
      try {
        const csv = await exportReportCSV(startDate, endDate, type);

        // Create and download file
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${type}-${startDate.toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast.success("Report exported successfully");
      } catch {
        toast.error("Failed to export report");
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("employee-hours")}>
          Employee Hours Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("project-hours")}>
          Project Hours Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("detailed")}>
          Detailed Time Entries
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
