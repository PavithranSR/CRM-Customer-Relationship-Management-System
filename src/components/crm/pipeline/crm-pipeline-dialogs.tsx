import type { CrmLeadItem, LeadStage } from "@/actions/crm.actions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { CUSTOM_FILTER_FIELDS } from "./crm-pipeline-config";
import type {
  ConfirmDialogState,
  CustomFilterField,
  CustomFilterRule,
  VisibleStage,
} from "./crm-pipeline-types";

export interface CrmPipelineDialogsProps {
  showCustomFilterDialog: boolean;
  onDiscardCustomFilter: () => void;
  draftCustomFilterMode: "any" | "all";
  onDraftCustomFilterModeChange: (value: "any" | "all") => void;
  draftCustomIncludeArchived: boolean;
  onDraftCustomIncludeArchivedChange: (checked: boolean) => void;
  draftCustomFilterRules: CustomFilterRule[];
  onUpdateDraftCustomRule: (id: string, patch: Partial<CustomFilterRule>) => void;
  onRemoveDraftCustomRule: (id: string) => void;
  onAddDraftCustomRule: () => void;
  onApplyCustomFilter: () => void;
  editingLead: CrmLeadItem | null;
  onEditingLeadChange: (lead: CrmLeadItem | null) => void;
  onUpdateLead: (lead: CrmLeadItem, formData: FormData) => void;
  visibleStages: VisibleStage[];
  stageLabels: Record<string, string>;
  salespersonLead: CrmLeadItem | null;
  onSalespersonLeadChange: (lead: CrmLeadItem | null) => void;
  deleteConfirmState: ConfirmDialogState | null;
  onDeleteConfirmStateChange: (value: ConfirmDialogState | null) => void;
  onConfirmDelete: () => void;
  archiveConfirmState: ConfirmDialogState | null;
  onArchiveConfirmStateChange: (value: ConfirmDialogState | null) => void;
  onConfirmArchive: () => void;
  stageDeleteConfirmKey: LeadStage | null;
  onStageDeleteConfirmKeyChange: (value: LeadStage | null) => void;
  onConfirmDeleteStage: () => void;
  isPending: boolean;
}

export function CrmPipelineDialogs({
  showCustomFilterDialog,
  onDiscardCustomFilter,
  draftCustomFilterMode,
  onDraftCustomFilterModeChange,
  draftCustomIncludeArchived,
  onDraftCustomIncludeArchivedChange,
  draftCustomFilterRules,
  onUpdateDraftCustomRule,
  onRemoveDraftCustomRule,
  onAddDraftCustomRule,
  onApplyCustomFilter,
  editingLead,
  onEditingLeadChange,
  onUpdateLead,
  visibleStages,
  stageLabels,
  salespersonLead,
  onSalespersonLeadChange,
  deleteConfirmState,
  onDeleteConfirmStateChange,
  onConfirmDelete,
  archiveConfirmState,
  onArchiveConfirmStateChange,
  onConfirmArchive,
  stageDeleteConfirmKey,
  onStageDeleteConfirmKeyChange,
  onConfirmDeleteStage,
  isPending,
}: CrmPipelineDialogsProps) {
  return (
    <>
      <Dialog open={showCustomFilterDialog} onOpenChange={(open) => !open && onDiscardCustomFilter()}>
        <DialogContent className="max-w-6xl p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Custom Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <span>Match</span>
                <select
                  value={draftCustomFilterMode}
                  onChange={(event) => onDraftCustomFilterModeChange(event.target.value as "any" | "all")}
                  className="h-8 rounded border border-slate-300 bg-white px-2"
                >
                  <option value="any">any</option>
                  <option value="all">all</option>
                </select>
                <span>of the following rules:</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={draftCustomIncludeArchived}
                  onChange={(event) => onDraftCustomIncludeArchivedChange(event.target.checked)}
                />
                Include archived
              </label>
            </div>

            <div className="space-y-2">
              {draftCustomFilterRules.map((rule) => {
                const isNumericField = rule.field === "value" || rule.field === "probability";
                return (
                  <div key={rule.id} className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_3fr_auto]">
                    <select
                      value={rule.field}
                      onChange={(event) =>
                        onUpdateDraftCustomRule(rule.id, {
                          field: event.target.value as CustomFilterField,
                          value: "",
                          operator: "contains",
                        })
                      }
                      className="h-10 rounded border border-slate-300 bg-white px-2"
                    >
                      {CUSTOM_FILTER_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={rule.value}
                      onChange={(event) => onUpdateDraftCustomRule(rule.id, { value: event.target.value })}
                      type={isNumericField ? "number" : "text"}
                      placeholder="Type to filter..."
                    />
                    <Button type="button" variant="ghost" className="h-10 px-2" onClick={() => onRemoveDraftCustomRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="text-sm font-medium text-teal-700 hover:underline"
              onClick={onAddDraftCustomRule}
            >
              New Rule
            </button>
          </div>
          <div className="flex items-center gap-2 border-t px-6 py-4">
            <Button type="button" className="bg-[#7c4a69] hover:bg-[#6d425d]" onClick={onApplyCustomFilter}>
              Search
            </Button>
            <Button type="button" variant="secondary" onClick={onDiscardCustomFilter}>
              Discard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLead} onOpenChange={(open) => !open && onEditingLeadChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          {editingLead ? (
            <form action={(formData) => onUpdateLead(editingLead, formData)} className="space-y-3">
              <Input name="title" defaultValue={editingLead.title} required />
              <Input name="clientName" defaultValue={editingLead.clientName || ""} />
              <Input name="email" type="email" defaultValue={editingLead.email || ""} />
              <Input name="phone" defaultValue={editingLead.phone || ""} />
              <Input name="value" type="number" min="0" step="0.01" defaultValue={editingLead.value || ""} />
              <select
                name="probabilityLevel"
                defaultValue={String(editingLead.probabilityLevel ?? 1)}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                <option value="1">Low (1 star)</option>
                <option value="2">Medium (2 stars)</option>
                <option value="3">High (3 stars)</option>
              </select>
              <select
                name="stage"
                defaultValue={editingLead.stage}
                className="h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {visibleStages.map((stage) => (
                  <option key={stage.key} value={stage.key}>
                    {stageLabels[stage.key] || stage.key}
                  </option>
                ))}
              </select>
              <Textarea name="notes" rows={3} defaultValue={editingLead.notes || ""} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onEditingLeadChange(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!salespersonLead} onOpenChange={(open) => !open && onSalespersonLeadChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salesperson Details</DialogTitle>
            <DialogDescription>Assigned salesperson information for this opportunity.</DialogDescription>
          </DialogHeader>
          {salespersonLead ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Opportunity</p>
                <p className="font-medium text-slate-900">{salespersonLead.title || "Opportunity"}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Salesperson</p>
                  <p className="font-medium text-slate-900">
                    {salespersonLead.createdByName || salespersonLead.createdByEmail || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="font-medium text-slate-900">{salespersonLead.createdByRole || "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="font-medium text-slate-900">{salespersonLead.createdByEmail || "-"}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmState} onOpenChange={(open) => !open && onDeleteConfirmStateChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirmState?.title || "Delete lead?"}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{deleteConfirmState?.detail || "This action cannot be undone."}</span>
              <span className="mt-1 block">Please confirm to delete the selected lead details.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmDelete();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!archiveConfirmState} onOpenChange={(open) => !open && onArchiveConfirmStateChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{archiveConfirmState?.title || "Archive lead?"}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">{archiveConfirmState?.detail || "This action will move the selected lead details to the archive page."}</span>
              <span className="mt-1 block">Please confirm to continue with archive.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmArchive();
              }}
              disabled={isPending}
            >
              {isPending ? "Archiving..." : "Confirm Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!stageDeleteConfirmKey} onOpenChange={(open) => !open && onStageDeleteConfirmKeyChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block">
                This action will delete stage &quot;
                {stageDeleteConfirmKey ? stageLabels[stageDeleteConfirmKey] || stageDeleteConfirmKey : ""}
                &quot; and move its leads.
              </span>
              <span className="mt-1 block">Please confirm to continue with deletion.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                onConfirmDeleteStage();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
