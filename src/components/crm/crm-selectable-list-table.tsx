"use client";

import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Trash2, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CrmSelectableListColumn<T> {
  key: string;
  label: string;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T) => ReactNode;
}

interface CrmSelectableListTableProps<T> {
  rows: T[];
  columns: CrmSelectableListColumn<T>[];
  emptyText: string;
  getRowId: (row: T) => string;
  getRowLabel: (row: T) => string;
  selectionAriaLabel: string;
  selectionEnabled?: boolean;
  getRowHref?: (row: T) => string | null;
  renderActions?: (row: T) => ReactNode;
  onDeleteSelected?: (rows: T[]) => Promise<void>;
  deleteDialogTitle: (count: number) => string;
  deleteDialogDescription: string;
  headerDeleteEventName?: string;
  tableMinWidthClassName?: string;
  tableStyle?: CSSProperties;
  tableMinWidthPx?: number;
  estimatedColumnMinWidthPx?: number;
  containerClassName?: string;
  rootClassName?: string;
  scrollAreaClassName?: string;
  stickyHeader?: boolean;
  compactRows?: boolean;
  columnVisibilityStorageKey?: string;
  columnVisibilityTitle?: string;
  columnVisibilityDescription?: string;
}

function areSameKeys(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function CrmSelectableListTable<T>({
  rows,
  columns,
  emptyText,
  getRowId,
  getRowLabel,
  selectionAriaLabel,
  selectionEnabled = true,
  getRowHref,
  renderActions,
  onDeleteSelected,
  deleteDialogTitle,
  deleteDialogDescription,
  headerDeleteEventName,
  tableMinWidthClassName = "min-w-[720px]",
  tableStyle,
  tableMinWidthPx,
  estimatedColumnMinWidthPx,
  containerClassName,
  rootClassName,
  scrollAreaClassName,
  stickyHeader = false,
  compactRows = false,
  columnVisibilityStorageKey,
  columnVisibilityTitle = "List Fields",
  columnVisibilityDescription = "Choose which columns to show.",
}: CrmSelectableListTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const columnSignature = columns.map((column) => column.key).join("\u0000");
  const columnKeys = useMemo(() => (columnSignature ? columnSignature.split("\u0000") : []), [columnSignature]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(columnKeys);
  const [hasLoadedStoredColumns, setHasLoadedStoredColumns] = useState(false);

  const rowIds = useMemo(() => rows.map((row) => getRowId(row)), [rows, getRowId]);
  const rowIdSet = useMemo(() => new Set(rowIds), [rowIds]);
  const visibleSelectedIds = useMemo(
    () => new Set(Array.from(selectedIds).filter((id) => rowIdSet.has(id))),
    [selectedIds, rowIdSet],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => visibleSelectedIds.has(getRowId(row))),
    [rows, visibleSelectedIds, getRowId],
  );
  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleColumnKeys.includes(column.key)),
    [columns, visibleColumnKeys],
  );

  const showColumnPicker = Boolean(columnVisibilityStorageKey && columns.length > 1);
  const showTrailingColumn = Boolean(renderActions || showColumnPicker);
  const visibleColumnCount = visibleColumns.length + (selectionEnabled ? 1 : 0) + (showTrailingColumn ? 1 : 0);
  const selectedCount = selectedRows.length;
  const allSelected = rowIds.length > 0 && rowIds.every((id) => visibleSelectedIds.has(id));
  const someSelected = !allSelected && rowIds.some((id) => visibleSelectedIds.has(id));
  const resolvedRootClassName = rootClassName ?? containerClassName ?? "space-y-3 p-3";

  const tableResolvedStyle = useMemo(() => {
    const estimatedMinWidth = estimatedColumnMinWidthPx ? visibleColumnCount * estimatedColumnMinWidthPx : 0;
    const resolvedMinWidth = Math.max(tableMinWidthPx || 0, estimatedMinWidth);

    if (!resolvedMinWidth) {
      return tableStyle;
    }

    return {
      ...tableStyle,
      minWidth: resolvedMinWidth,
    };
  }, [estimatedColumnMinWidthPx, tableMinWidthPx, tableStyle, visibleColumnCount]);

  const cellPaddingClassName = compactRows ? "px-3 py-2.5" : "p-3";
  const actionCellPaddingClassName = compactRows ? "px-3 py-2" : "p-3";
  const stickyHeaderCellClassName = stickyHeader ? "sticky top-0 z-10 border-b border-slate-200 bg-slate-50" : "";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const normalizeVisibleColumnKeys = (keys: string[]) => {
      const next = columnKeys.filter((key) => keys.includes(key));
      return next.length > 0 ? next : columnKeys;
    };

    if (!columnVisibilityStorageKey || typeof window === "undefined") {
      setVisibleColumnKeys((current) => {
        const next = normalizeVisibleColumnKeys(current.length > 0 ? current : columnKeys);
        return areSameKeys(current, next) ? current : next;
      });
      setHasLoadedStoredColumns(true);
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(columnVisibilityStorageKey);
      if (!storedValue) {
        setVisibleColumnKeys((current) => (areSameKeys(current, columnKeys) ? current : columnKeys));
        setHasLoadedStoredColumns(true);
        return;
      }

      const parsed = JSON.parse(storedValue);
      if (!Array.isArray(parsed)) {
        setVisibleColumnKeys((current) => (areSameKeys(current, columnKeys) ? current : columnKeys));
        setHasLoadedStoredColumns(true);
        return;
      }

      const next = normalizeVisibleColumnKeys(parsed.filter((value): value is string => typeof value === "string"));
      setVisibleColumnKeys((current) => (areSameKeys(current, next) ? current : next));
    } catch {
      setVisibleColumnKeys((current) => (areSameKeys(current, columnKeys) ? current : columnKeys));
    } finally {
      setHasLoadedStoredColumns(true);
    }
  }, [columnKeys, columnVisibilityStorageKey]);

  useEffect(() => {
    if (!columnVisibilityStorageKey || !hasLoadedStoredColumns || typeof window === "undefined") return;
    window.localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(visibleColumnKeys));
  }, [columnVisibilityStorageKey, hasLoadedStoredColumns, visibleColumnKeys]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  useEffect(() => {
    if (!headerDeleteEventName || !onDeleteSelected) return;

    const onHeaderDelete = () => {
      if (selectedRows.length === 0) return;
      setDeleteConfirmIds(selectedRows.map((row) => getRowId(row)));
    };

    window.addEventListener(headerDeleteEventName, onHeaderDelete);
    return () => window.removeEventListener(headerDeleteEventName, onHeaderDelete);
  }, [headerDeleteEventName, onDeleteSelected, selectedRows, getRowId]);

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(rowIds) : new Set());
  };

  const toggleRow = (rowId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowId);
      else next.delete(rowId);
      return next;
    });
  };

  const toggleColumn = (columnKey: string, checked: boolean) => {
    setVisibleColumnKeys((current) => {
      if (checked) {
        const next = columnKeys.filter((key) => key === columnKey || current.includes(key));
        return next.length > 0 ? next : columnKeys;
      }

      if (current.length === 1 && current.includes(columnKey)) {
        return current;
      }

      const next = columnKeys.filter((key) => key !== columnKey && current.includes(key));
      return next.length > 0 ? next : current;
    });
  };

  const runDelete = async (ids: string[]) => {
    if (!onDeleteSelected) return;
    const rowsToDelete = rows.filter((row) => ids.includes(getRowId(row)));

    startTransition(async () => {
      await onDeleteSelected(rowsToDelete);
      setSelectedIds(new Set());
    });
  };

  const columnPickerButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      aria-label="Choose visible list columns"
      disabled={!hasMounted}
      tabIndex={hasMounted ? 0 : -1}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </Button>
  );

  return (
    <div className={resolvedRootClassName}>
      {selectionEnabled && selectedCount > 0 ? (
        <div className="flex h-auto w-full max-w-[420px] flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 sm:h-9 sm:flex-nowrap sm:py-0">
          <p className="text-sm font-medium text-red-700">{selectedCount} selected</p>
          <div className="flex items-center gap-1">
            {onDeleteSelected ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => setDeleteConfirmIds(selectedRows.map((row) => getRowId(row)))}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Delete selected rows"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isPending ? "Deleting..." : "Delete"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-700 hover:bg-red-100"
              aria-label="Clear selected rows"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className={cn("overflow-x-auto", scrollAreaClassName)}>
        <table className={cn("w-full text-sm", tableMinWidthClassName)} style={tableResolvedStyle}>
          <thead className={cn(stickyHeader && "bg-slate-50/95 backdrop-blur")}>
            <tr className="border-b text-left">
              {selectionEnabled ? (
                <th className={cn(`w-12 ${cellPaddingClassName}`, stickyHeaderCellClassName)}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                    aria-label={selectionAriaLabel}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                  />
                </th>
              ) : null}
              {visibleColumns.map((column) => (
                <th
                  key={column.key}
                  className={cn(cellPaddingClassName, column.headerClassName, stickyHeaderCellClassName)}
                >
                  {column.label}
                </th>
              ))}
              {showTrailingColumn ? (
                <th className={cn(`w-14 ${actionCellPaddingClassName} text-right`, stickyHeaderCellClassName)}>
                  {showColumnPicker ? (
                    hasMounted ? (
                      <Popover>
                        <PopoverTrigger asChild>{columnPickerButton}</PopoverTrigger>
                        <PopoverContent align="end" className="w-[260px] p-0">
                          <div className="border-b border-slate-200 px-4 py-3 text-left">
                            <p className="text-sm font-semibold text-slate-900">{columnVisibilityTitle}</p>
                            <p className="text-xs text-slate-500">{columnVisibilityDescription}</p>
                          </div>
                          <div className="max-h-[420px] space-y-1 overflow-y-auto px-2 py-2">
                            {columns.map((column) => {
                              const checked = visibleColumnKeys.includes(column.key);
                              const isOnlySelected = checked && visibleColumnKeys.length === 1;

                              return (
                                <label
                                  key={column.key}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-900 hover:bg-slate-50",
                                    isOnlySelected && "cursor-not-allowed opacity-60",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={isOnlySelected}
                                    onChange={(event) => toggleColumn(column.key, event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                                  />
                                  <span>{column.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      columnPickerButton
                    )
                  ) : null}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectionEnabled ? 1 : 0) + (showTrailingColumn ? 1 : 0)}
                  className="p-8 text-center text-slate-500"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const rowId = getRowId(row);
                const rowHref = getRowHref?.(row) || null;

                return (
                  <tr
                    key={rowId}
                    className={`border-b hover:bg-slate-50 ${rowHref ? "cursor-pointer" : ""}`}
                    onClick={rowHref ? () => router.push(rowHref) : undefined}
                  >
                    {selectionEnabled ? (
                      <td className={cellPaddingClassName} onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={visibleSelectedIds.has(rowId)}
                          onChange={(event) => toggleRow(rowId, event.target.checked)}
                          aria-label={`Select ${getRowLabel(row)}`}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-600"
                        />
                      </td>
                    ) : null}
                    {visibleColumns.map((column) => (
                      <td key={column.key} className={cn(cellPaddingClassName, column.cellClassName)}>
                        {column.render(row)}
                      </td>
                    ))}
                    {showTrailingColumn ? (
                      <td className={`${actionCellPaddingClassName} text-right`} onClick={(event) => event.stopPropagation()}>
                        {renderActions ? renderActions(row) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {onDeleteSelected ? (
        <AlertDialog open={!!deleteConfirmIds} onOpenChange={(open) => !open && setDeleteConfirmIds(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteDialogTitle(deleteConfirmIds?.length || 0)}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteConfirmIds) {
                    void runDelete(deleteConfirmIds);
                  }
                  setDeleteConfirmIds(null);
                }}
                className="bg-red-600 hover:bg-red-700"
                disabled={isPending}
              >
                {isPending ? "Deleting..." : "Confirm Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
