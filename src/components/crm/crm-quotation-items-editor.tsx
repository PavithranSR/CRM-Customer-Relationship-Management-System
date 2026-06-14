"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { upsertQuotationItems } from "@/actions/quotation.actions";
import type { CrmProjectTypeItem } from "@/actions/crm-project-types.actions";
import { CrmProjectPickerDialog, type ProjectPickerProject } from "@/components/crm/crm-project-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuotationItem {
  id: string;
  name: string;
  unitCount: number;
  amount: number;
  gstPercent: number;
  tags: string | null;
}

interface CrmQuotationItemsEditorProps {
  quotationId: string;
  items: QuotationItem[];
  projectTypes: Array<
    Pick<
      CrmProjectTypeItem,
      "id" | "name" | "budget" | "category" | "gstPercent" | "status" | "description" | "createdAt" | "updatedAt"
    >
  >;
}

function mergeCategoryTag(tags: string, category: string) {
  const categoryTag = `Category: ${category}`;
  const plainTags = tags
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^category\s*:/i.test(entry));

  return [categoryTag, ...plainTags].join(", ");
}

export function CrmQuotationItemsEditor({ quotationId, items, projectTypes }: CrmQuotationItemsEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [projectPickerLineId, setProjectPickerLineId] = useState<string | null>(null);
  const [availableProjectTypes, setAvailableProjectTypes] = useState(projectTypes);
  const [lineItems, setLineItems] = useState(() =>
    items.map((item) => ({
      id: item.id,
      name: item.name,
      unitCount: String(item.unitCount ?? 1),
      amount: String(item.amount ?? 0),
      gstPercent: String(item.gstPercent ?? 0),
      tags: item.tags || "",
    }))
  );

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const gstAmount = lineItems.reduce(
      (sum, item) => sum + Number(item.amount || 0) * (Number(item.gstPercent || 0) / 100),
      0
    );
    return { subtotal, gstAmount, total: subtotal + gstAmount };
  }, [lineItems]);

  const handleLineChange = (id: string, field: keyof (typeof lineItems)[number], value: string) => {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleProjectNameChange = (id: string, value: string) => {
    if (value.trim().toLowerCase() === "see more") {
      setProjectPickerLineId(id);
      return;
    }
    const matched = availableProjectTypes.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              name: value,
              amount: matched ? String(matched.budget) : item.amount,
              gstPercent: matched ? String(matched.gstPercent) : item.gstPercent,
              tags: matched ? mergeCategoryTag(item.tags, matched.category || "Other") : item.tags,
            }
          : item,
      ),
    );
  };

  const handleProjectDialogSelect = (projectType: ProjectPickerProject) => {
    if (!projectPickerLineId) return;

    setLineItems((prev) =>
      prev.map((item) =>
        item.id === projectPickerLineId
          ? {
              ...item,
              name: projectType.name,
              amount: String(projectType.budget || 0),
              gstPercent: String(projectType.gstPercent || 0),
              tags: mergeCategoryTag(item.tags, projectType.category || "Other"),
            }
          : item,
      ),
    );
  };

  const handleProjectCreated = (projectType: ProjectPickerProject) => {
    setAvailableProjectTypes((items) => {
      const nextItems = items.filter((item) => item.id !== projectType.id);
      return [projectType, ...nextItems];
    });
  };

  const selectedProjectName =
    projectPickerLineId === null ? "" : lineItems.find((item) => item.id === projectPickerLineId)?.name || "";

  const handleSave = () => {
    startTransition(async () => {
      const payload = lineItems.map((item) => ({
        id: item.id,
        name: item.name,
        unitCount: Number(item.unitCount || 1),
        amount: Number(item.amount || 0),
        gstPercent: Number(item.gstPercent || 0),
        tags: item.tags || null,
      }));
      const result = await upsertQuotationItems(quotationId, payload);
      if (result?.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not update projects");
        return;
      }
      toast.success("Projects updated");
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Projects</h3>
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <datalist id="crm-project-type-options-editor">
          {availableProjectTypes.map((projectType) => (
            <option key={projectType.id} value={projectType.name} />
          ))}
          <option value="See more" />
        </datalist>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2 text-right">Unit Count</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">GST %</th>
              <th className="px-3 py-2">Tags</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No project rows available to edit.
                </td>
              </tr>
            ) : (
              lineItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <Input
                      value={item.name}
                      onChange={(event) => handleProjectNameChange(item.id, event.target.value)}
                      placeholder="Project name"
                      list="crm-project-type-options-editor"
                      autoComplete="off"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      value={item.unitCount}
                      onChange={(event) => handleLineChange(item.id, "unitCount", event.target.value)}
                      className="text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.amount}
                      onChange={(event) => handleLineChange(item.id, "amount", event.target.value)}
                      className="text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.gstPercent}
                      onChange={(event) => handleLineChange(item.id, "gstPercent", event.target.value)}
                      className="text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={item.tags}
                      onChange={(event) => handleLineChange(item.id, "tags", event.target.value)}
                      placeholder="e.g. Priority, VIP"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2 rounded-md border bg-slate-50/60 p-3 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold">{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST</span>
            <span className="font-semibold">{totals.gstAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <CrmProjectPickerDialog
        open={projectPickerLineId !== null}
        onOpenChange={(open) => {
          if (!open) setProjectPickerLineId(null);
        }}
        projectTypes={availableProjectTypes}
        onSelect={handleProjectDialogSelect}
        onProjectCreated={handleProjectCreated}
        selectedProjectName={selectedProjectName}
      />
    </div>
  );
}
