"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteTimeEntry } from "@/actions/time-entry.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TimeEntry {
  id: string;
  date: Date;
  hours: number;
  description: string | null;
  isBillable: boolean;
  user: { id: string; name: string };
  project: { id: string; name: string; code: string };
}

interface TimeEntryTableProps {
  entries: TimeEntry[];
  currentUserId: string;
  showEmployeeColumn: boolean;
  canManageOthers: boolean;
}

export function TimeEntryTable({
  entries,
  currentUserId,
  showEmployeeColumn,
  canManageOthers,
}: TimeEntryTableProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    if (!deleteId) return;

    startTransition(async () => {
      const result = await deleteTimeEntry(deleteId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Time entry deleted");
      }
      setDeleteId(null);
    });
  };

  const canEdit = (entry: TimeEntry) => {
    return canManageOthers || entry.user.id === currentUserId;
  };

  // Group entries by date
  const groupedEntries: Record<string, TimeEntry[]> = {};
  entries.forEach((entry) => {
    const dateKey = format(new Date(entry.date), "yyyy-MM-dd");
    if (!groupedEntries[dateKey]) {
      groupedEntries[dateKey] = [];
    }
    groupedEntries[dateKey].push(entry);
  });

  const sortedDates = Object.keys(groupedEntries).sort((a, b) => b.localeCompare(a));

  return (
    <>
      <div className="space-y-4">
        <div className="grid gap-3 md:hidden">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              No time entries found
            </div>
          ) : (
            sortedDates.map((dateKey) => (
              <div key={dateKey} className="space-y-3">
                <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                  {format(new Date(dateKey), "MMM d, yyyy")} - {format(new Date(dateKey), "EEEE")}
                </div>
                {groupedEntries[dateKey].map((entry) => (
                  <div key={entry.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/projects/${entry.project.id}`} className="block truncate font-semibold hover:underline">
                          {entry.project.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{entry.project.code}</p>
                      </div>
                      {canEdit(entry) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isPending}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/work-tracking/${entry.id}/edit`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteId(entry.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      {showEmployeeColumn ? (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Employee</p>
                          <p className="mt-1">{entry.user.name}</p>
                        </div>
                      ) : null}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hours</p>
                        <p className="mt-1 font-medium">{entry.hours}h</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billable</p>
                        <div className="mt-1">
                          <Badge variant={entry.isBillable ? "default" : "secondary"}>
                            {entry.isBillable ? "Yes" : "No"}
                          </Badge>
                        </div>
                      </div>
                      <div className={showEmployeeColumn ? "sm:col-span-2" : ""}>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                        <p className="mt-1 text-sm text-slate-700">{entry.description || "-"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="hidden rounded-md border md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                {showEmployeeColumn && <TableHead>Employee</TableHead>}
                <TableHead>Project</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Billable</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showEmployeeColumn ? 7 : 6} className="py-8 text-center text-muted-foreground">
                    No time entries found
                  </TableCell>
                </TableRow>
              ) : (
                sortedDates.map((dateKey) => (
                  groupedEntries[dateKey].map((entry, index) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {index === 0 ? (
                          <div>
                            <p className="font-medium">{format(new Date(entry.date), "MMM d, yyyy")}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(entry.date), "EEEE")}
                            </p>
                          </div>
                        ) : null}
                      </TableCell>
                      {showEmployeeColumn && (
                        <TableCell>{entry.user.name}</TableCell>
                      )}
                      <TableCell>
                        <Link href={`/projects/${entry.project.id}`} className="hover:underline">
                          {entry.project.name}
                        </Link>
                        <p className="text-sm text-muted-foreground">{entry.project.code}</p>
                      </TableCell>
                      <TableCell className="font-medium">{entry.hours}h</TableCell>
                      <TableCell className="max-w-xs">{entry.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={entry.isBillable ? "default" : "secondary"}>
                          {entry.isBillable ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canEdit(entry) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={isPending}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/work-tracking/${entry.id}/edit`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteId(entry.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Daily Summary */}
      {entries.length > 0 && (
        <div className="mt-4 rounded-2xl bg-gray-50 p-4 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">Total Hours</span>
            <span className="text-xl font-bold">
              {entries.reduce((sum, e) => sum + e.hours, 0).toFixed(1)}h
            </span>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete time entry?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will permanently delete the selected time entry.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
