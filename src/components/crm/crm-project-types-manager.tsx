"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { CrmProjectTypeItem } from "@/actions/crm-project-types.actions";
import { createCrmProjectType, deleteCrmProjectType, updateCrmProjectType } from "@/actions/crm-project-types.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";
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

interface CrmProjectTypesManagerProps {
  items: CrmProjectTypeItem[];
  defaultShowNew?: boolean;
  showNewToggle?: boolean;
  viewMode?: "list" | "table" | "kanban";
  groupBy?: string;
  projectCategoryValues?: string[];
  projectBudgetRangeValues?: string[];
  hasBudgetLimits?: boolean;
}

export function CrmProjectTypesManager({
  items,
  defaultShowNew = false,
  showNewToggle = true,
  viewMode = "list",
  groupBy = "",
  projectCategoryValues = [],
  projectBudgetRangeValues = [],
  hasBudgetLimits = false,
}: CrmProjectTypesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(defaultShowNew);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Other");
  const [editBudget, setEditBudget] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleCreate = () => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("budget", budget);

    startTransition(async () => {
      const result = await createCrmProjectType(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project type added");
      setName("");
      setBudget("");
      setShowNew(false);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCrmProjectType(id);
        toast.success("Project type removed");
        router.refresh();
      } catch {
        toast.error("Could not remove project type");
      }
    });
  };
  const handleDeleteMany = useCallback(async (selectedRows: CrmProjectTypeItem[]) => {
    if (selectedRows.length === 0) {
      toast.error("Select at least one project");
      return;
    }

    for (const row of selectedRows) {
      try {
        await deleteCrmProjectType(row.id);
      } catch {
        toast.error(`Could not remove ${row.name}`);
        router.refresh();
        return;
      }
    }

    toast.success(`${selectedRows.length} project(s) removed`);
    router.refresh();
  }, [router]);

  const handleEditStart = (item: CrmProjectTypeItem) => {
    const query = searchParams.toString();
    const currentHref = query ? `${pathname}?${query}` : pathname;
    router.push(`/crm/projects/${item.id}/edit?next=${encodeURIComponent(currentHref)}`);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditName("");
    setEditCategory("Other");
    setEditBudget("");
  };

  const handleEditSave = (id: string) => {
    const formData = new FormData();
    formData.set("name", editName);
    formData.set("category", editCategory);
    formData.set("budget", editBudget);

    startTransition(async () => {
      const result = await updateCrmProjectType(id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Project type updated");
      handleEditCancel();
      router.refresh();
    });
  };

  const orderedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const effectiveKanbanGroupBy =
    groupBy ||
    (projectBudgetRangeValues.length > 0 || hasBudgetLimits
      ? "budget"
      : projectCategoryValues.length > 0
        ? "category"
        : "category");
  const getKanbanBucketLabel = (item: CrmProjectTypeItem) => {
    if (effectiveKanbanGroupBy === "budget") {
      if (item.budget <= 5000) return "Budget <= 5,000";
      if (item.budget <= 20000) return "Budget 5,001 - 20,000";
      return "Budget >= 20,001";
    }

    if (effectiveKanbanGroupBy === "create_date") {
      return new Date(item.createdAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    if (effectiveKanbanGroupBy === "project_name") {
      return item.name;
    }

    if (effectiveKanbanGroupBy === "status") {
      return (item.status || "Active").trim() || "Active";
    }

    return (item.category || "Other").trim() || "Other";
  };
  const kanbanBuckets = orderedItems.reduce<
    Record<string, { label: string; count: number; total: number; items: CrmProjectTypeItem[] }>
  >((acc, item) => {
    const label = getKanbanBucketLabel(item);
    if (!acc[label]) {
      acc[label] = {
        label,
        count: 0,
        total: 0,
        items: [],
      };
    }
    acc[label].count += 1;
    acc[label].total += Number(item.budget || 0);
    acc[label].items.push(item);
    return acc;
  }, {});
  const sortedKanbanBuckets = Object.values(kanbanBuckets).sort((a, b) => {
    if (effectiveKanbanGroupBy === "budget") {
      const order = ["Budget <= 5,000", "Budget 5,001 - 20,000", "Budget >= 20,001"];
      return order.indexOf(a.label) - order.indexOf(b.label);
    }
    if (effectiveKanbanGroupBy === "create_date") {
      const aDate = a.items[0] ? new Date(a.items[0].createdAt).getTime() : 0;
      const bDate = b.items[0] ? new Date(b.items[0].createdAt).getTime() : 0;
      return bDate - aDate;
    }
    return a.label.localeCompare(b.label);
  });
  const getGstAmount = (item: CrmProjectTypeItem) => Number(item.budget || 0) * (Number(item.gstPercent || 0) / 100);
  const getTotalBudget = (item: CrmProjectTypeItem) => Number(item.budget || 0) + getGstAmount(item);
  const formatAmount = (value: number) => Number(value || 0).toFixed(2);
  const formatDateValue = (value: Date) =>
    new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const renderKanbanCard = (item: CrmProjectTypeItem) => (
    <div
      key={item.id}
      className="cursor-pointer bg-white px-3 py-2.5 transition hover:bg-slate-50"
      onClick={() => router.push(`/crm/projects/${item.id}`)}
    >
      {editingId === item.id ? (
        <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
          <Input
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            placeholder="Project type"
            disabled={isPending}
          />
          <select
            value={editCategory}
            onChange={(event) => setEditCategory(event.target.value)}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            disabled={isPending}
          >
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Internship">Internship</option>
            <option value="Support">Support</option>
            <option value="Other">Other</option>
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={editBudget}
            onChange={(event) => setEditBudget(event.target.value)}
            placeholder="Budget"
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => handleEditSave(item.id)} disabled={isPending}>
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <Link href={`/crm/projects/${item.id}`} className="text-base font-semibold leading-tight text-slate-950 hover:underline">
              {item.name}
            </Link>
            <div onClick={(event) => event.stopPropagation()}>
              <CrmRowActionMenu
                label={`Actions for ${item.name}`}
                items={[
                  { label: "Edit", onClick: () => handleEditStart(item), disabled: isPending },
                  { label: "Delete", destructive: true, onClick: () => setDeleteId(item.id), disabled: isPending },
                ]}
              />
            </div>
          </div>
          <div className="mt-2.5 space-y-1 text-sm text-slate-700">
            <p><span className="text-slate-500">Category:</span> {item.category || "Other"}</p>
            <p className="text-[15px] font-semibold text-slate-950">Budget: {getTotalBudget(item).toFixed(2)}</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {showNewToggle ? (
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowNew((value) => !value)} disabled={isPending}>
            New
          </Button>
        </div>
      ) : null}

      {showNew ? (
        <div className="rounded-md border bg-white p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              placeholder="Project type (e.g. Hardware)"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Budget"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              disabled={isPending}
            />
            <Button onClick={handleCreate} disabled={isPending}>
              Enter
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-md border bg-white">
        {items.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No project types yet</div>
        ) : viewMode === "kanban" ? (
          <div className="overflow-x-auto p-3 sm:p-4">
            <div className="flex min-w-max items-start gap-4">
              {sortedKanbanBuckets.map((bucket) => (
                <div key={bucket.label} className="w-[240px] shrink-0 overflow-hidden border border-slate-300 bg-white sm:w-[270px]">
                  <div className="border-b border-slate-300 bg-cyan-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold leading-tight text-slate-950">{bucket.label}</p>
                        <p className="mt-1 text-xs text-slate-600">{bucket.count}</p>
                      </div>
                      <p className="text-sm font-semibold leading-tight text-slate-900">{bucket.total.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="space-y-0 divide-y divide-slate-200">
                    {bucket.items.map((item) => renderKanbanCard(item))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          editingId ? (
            <div className="p-4">
              <div className="grid gap-3 rounded-md border border-slate-200 p-4 md:grid-cols-[2fr,1.2fr,1.2fr,auto]">
                <Input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="Project type"
                  disabled={isPending}
                />
                <select
                  value={editCategory}
                  onChange={(event) => setEditCategory(event.target.value)}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                  disabled={isPending}
                >
                  <option value="Hardware">Hardware</option>
                  <option value="Software">Software</option>
                  <option value="Internship">Internship</option>
                  <option value="Support">Support</option>
                  <option value="Other">Other</option>
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editBudget}
                  onChange={(event) => setEditBudget(event.target.value)}
                  placeholder="Budget"
                  className="text-right"
                  disabled={isPending}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={() => handleEditSave(editingId)} disabled={isPending}>
                    Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <CrmSelectableListTable
              rows={orderedItems}
              columns={[
                {
                  key: "name",
                  label: "Project",
                  cellClassName: "font-medium text-slate-900",
                  render: (item) => <Link href={`/crm/projects/${item.id}`} className="hover:underline">{item.name}</Link>,
                },
                { key: "category", label: "Category", render: (item) => item.category || "Other" },
                { key: "status", label: "Status", render: (item) => item.status || "Active" },
                {
                  key: "description",
                  label: "Description",
                  cellClassName: "max-w-[260px] truncate text-slate-600",
                  render: (item) => item.description?.trim() || "-",
                },
                {
                  key: "budget",
                  label: "Budget",
                  headerClassName: "text-right",
                  cellClassName: "text-right",
                  render: (item) => formatAmount(item.budget),
                },
                {
                  key: "gstPercent",
                  label: "GST %",
                  headerClassName: "text-right",
                  cellClassName: "text-right",
                  render: (item) => `${Number(item.gstPercent || 0).toFixed(2)}%`,
                },
                {
                  key: "gstAmount",
                  label: "GST Amount",
                  headerClassName: "text-right",
                  cellClassName: "text-right",
                  render: (item) => formatAmount(getGstAmount(item)),
                },
                {
                  key: "totalBudget",
                  label: "Total Budget",
                  headerClassName: "text-right",
                  cellClassName: "text-right font-medium text-slate-900",
                  render: (item) => formatAmount(getTotalBudget(item)),
                },
                { key: "createdAt", label: "Created On", render: (item) => formatDateValue(item.createdAt) },
                { key: "updatedAt", label: "Updated On", render: (item) => formatDateValue(item.updatedAt) },
              ]}
              emptyText="No project types yet"
              getRowId={(item) => item.id}
              getRowLabel={(item) => item.name}
              selectionAriaLabel="Select all projects"
              getRowHref={(item) => `/crm/projects/${item.id}`}
              renderActions={(item) => (
                <div className="flex justify-end">
                  <CrmRowActionMenu
                    label={`Actions for ${item.name}`}
                    items={[
                      { label: "Open", href: `/crm/projects/${item.id}` },
                      { label: "Edit", onClick: () => handleEditStart(item), disabled: isPending },
                      { label: "Delete", destructive: true, onClick: () => setDeleteId(item.id), disabled: isPending },
                    ]}
                  />
                </div>
              )}
              onDeleteSelected={handleDeleteMany}
              deleteDialogTitle={(count) => (count === 1 ? "Delete project?" : `Delete ${count} projects?`)}
              deleteDialogDescription="This action will remove the selected project details. Please confirm to continue with deletion."
              columnVisibilityStorageKey="crm-project-list-columns"
              columnVisibilityTitle="List Fields"
              columnVisibilityDescription="Choose which project details to show."
              tableMinWidthClassName="min-w-[1180px]"
            />
          )
        )}
      </div>
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project type?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">This action will remove the selected project type details.</span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) handleDelete(deleteId);
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
