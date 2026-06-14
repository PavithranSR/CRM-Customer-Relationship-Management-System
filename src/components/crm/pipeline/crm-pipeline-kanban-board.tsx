import type { RefObject } from "react";
import {
  Check,
  ChevronsLeftRight,
  ChevronsRight,
  Clock3,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { CrmLeadItem, LeadStage } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { STAGE_THEMES } from "./crm-pipeline-config";
import { getLeadAvatarColorClass } from "./crm-pipeline-utils";
import type { GroupedPipelineStage, StageTheme } from "./crm-pipeline-types";

export interface CrmPipelineKanbanBoardProps {
  groupedBySelectedField: GroupedPipelineStage[];
  currency: Intl.NumberFormat;
  shortCurrency: Intl.NumberFormat;
  isStageGrouping: boolean;
  foldedStages: Record<string, boolean>;
  stageThemeByKey: Record<string, StageTheme>;
  draggingLeadId: string | null;
  dragOverStage: LeadStage | null;
  editingStageKey: LeadStage | null;
  editingStageLabel: string;
  showAddStageInput: boolean;
  newStageLabel: string;
  activityOpenLeadId: string | null;
  kanbanScrollRef: RefObject<HTMLDivElement | null>;
  addStagePanelRef: RefObject<HTMLDivElement | null>;
  onOpenLeadDetails: (leadId: string) => void;
  onEditLead: (lead: CrmLeadItem) => void;
  onRequestDelete: (ids: string[]) => void;
  onOpenCreate: () => void;
  onShowAddStageInput: () => void;
  onStageDragStart: (stageKey: LeadStage) => void;
  onLeadDragStart: (leadId: string) => void;
  onDragEnd: () => void;
  onStageDragOver: (stageKey: LeadStage) => void;
  onKanbanDragOver: (clientX: number) => void;
  onStageDragLeave: (stageKey: LeadStage) => void;
  onStageDrop: (stageKey: LeadStage) => void;
  onEditingStageLabelChange: (value: string) => void;
  onSaveStageLabel: () => void;
  onCancelEditStage: () => void;
  onStartEditStage: (stageKey: LeadStage) => void;
  onToggleFoldStage: (stageKey: LeadStage) => void;
  onRequestDeleteStage: (stageKey: LeadStage) => void;
  onNewStageLabelChange: (value: string) => void;
  onConfirmAddStage: () => void;
  onCancelAddStage: () => void;
  onToggleActivityCard: (leadId: string) => void;
  onScheduleActivity: (lead: CrmLeadItem) => void;
  onShowSalespersonLead: (lead: CrmLeadItem) => void;
}

export function CrmPipelineKanbanBoard({
  groupedBySelectedField,
  currency,
  shortCurrency,
  isStageGrouping,
  foldedStages,
  stageThemeByKey,
  draggingLeadId,
  dragOverStage,
  editingStageKey,
  editingStageLabel,
  showAddStageInput,
  newStageLabel,
  activityOpenLeadId,
  kanbanScrollRef,
  addStagePanelRef,
  onOpenLeadDetails,
  onEditLead,
  onRequestDelete,
  onOpenCreate,
  onShowAddStageInput,
  onStageDragStart,
  onLeadDragStart,
  onDragEnd,
  onStageDragOver,
  onKanbanDragOver,
  onStageDragLeave,
  onStageDrop,
  onEditingStageLabelChange,
  onSaveStageLabel,
  onCancelEditStage,
  onStartEditStage,
  onToggleFoldStage,
  onRequestDeleteStage,
  onNewStageLabelChange,
  onConfirmAddStage,
  onCancelAddStage,
  onToggleActivityCard,
  onScheduleActivity,
  onShowSalespersonLead,
}: CrmPipelineKanbanBoardProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={kanbanScrollRef} className="relative flex h-full min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-auto overscroll-contain">
        {groupedBySelectedField.map((stage) => {
          const isFolded = isStageGrouping && Boolean(foldedStages[stage.key]);
          const stageTheme = stageThemeByKey[stage.key] ?? STAGE_THEMES[0];

          return (
          <div
            key={stage.key}
            className={`${isFolded ? "w-[42px] min-w-[42px] self-start" : "w-[280px] min-w-[280px] min-h-full self-stretch"} flex shrink-0 flex-col transition-all ${dragOverStage === stage.key ? "bg-transparent" : "bg-transparent"}`}
            onDragOver={(event) => {
              if (!isStageGrouping) return;
              event.preventDefault();
              onKanbanDragOver(event.clientX);
              onStageDragOver(stage.key as LeadStage);
            }}
            onDragLeave={() => {
              if (!isStageGrouping) return;
              onStageDragLeave(stage.key as LeadStage);
            }}
            onDrop={(event) => {
              if (!isStageGrouping) return;
              event.preventDefault();
              onStageDrop(stage.key as LeadStage);
            }}
          >
            <div
              className={`group sticky top-0 z-30 relative w-full ${isStageGrouping && !isFolded ? "cursor-grab active:cursor-grabbing" : ""} ${
                isFolded
                  ? `${stageTheme.folded} flex min-h-[220px] items-start justify-center rounded-none p-1`
                  : `${stageTheme.header} flex items-center justify-between gap-2 rounded-none border border-slate-400 px-3 py-2 shadow-sm`
              }`}
              draggable={isStageGrouping && !isFolded}
              onDragStart={() => {
                if (!isFolded) {
                  onStageDragStart(stage.key as LeadStage);
                }
              }}
              onDragEnd={onDragEnd}
            >
              <div
                className={`${isStageGrouping && !isFolded ? "cursor-grab active:cursor-grabbing" : ""} ${isFolded ? "text-center" : "min-w-0"}`}
              >
                {isStageGrouping && editingStageKey === stage.key ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingStageLabel}
                      onChange={(event) => onEditingStageLabelChange(event.target.value)}
                      className="h-8 w-36 bg-white"
                    />
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onSaveStageLabel}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={onCancelEditStage}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className={`${isFolded ? "hidden" : ""} min-w-0`}>
                    <h2 className="overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold leading-5 tracking-tight text-slate-900">
                      {stage.label}
                    </h2>
                  </div>
                )}
              </div>

              <div
                className={`flex shrink-0 items-center justify-end gap-1.5 whitespace-nowrap pl-1.5 ${isFolded ? "hidden" : ""}`}
              >
                <p className="text-sm font-semibold leading-none tabular-nums text-slate-900">
                  {shortCurrency.format(stage.expectedRevenueTotal)}
                </p>
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0 text-xs font-semibold leading-none text-slate-700">
                  {stage.items.length}
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 rounded-sm p-0" onClick={onOpenCreate}>
                  <Plus className="h-3 w-3" />
                </Button>
                {isStageGrouping ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Settings2 className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onToggleFoldStage(stage.key as LeadStage)}>
                        {isFolded ? "Unfold stage" : "Fold stage"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStartEditStage(stage.key as LeadStage)}>
                        Edit stage
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => onRequestDeleteStage(stage.key as LeadStage)}>
                        Delete stage
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              {isFolded ? (
                <div className="absolute left-1 top-1 flex flex-col items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-700 hover:bg-slate-200"
                    draggable={false}
                    onMouseDown={(event) => event.stopPropagation()}
                    onDragStart={(event) => event.preventDefault()}
                    onClick={() => onToggleFoldStage(stage.key as LeadStage)}
                  >
                    <ChevronsLeftRight className="h-4 w-4" />
                  </Button>
                  <span className="[writing-mode:vertical-rl] rotate-180 text-3xl font-medium leading-none text-slate-700">
                    {stage.label}
                  </span>
                </div>
              ) : null}
            </div>

            <div className={`flex min-h-0 flex-1 flex-col p-0 ${isFolded ? "hidden" : ""}`}>
              {stage.items.length === 0 ? (
                <div className="flex h-full min-h-0 flex-1 items-center justify-center rounded-sm border border-dashed p-4 text-center text-sm text-muted-foreground">
                  No opportunities
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {stage.items.map((lead, index) => (
                    <div
                      key={lead.id}
                      data-lead-card="true"
                      className={`cursor-pointer border-x border-b border-slate-400 bg-white px-2.5 py-2 transition hover:bg-slate-50 ${
                        draggingLeadId === lead.id ? "opacity-60" : ""
                      } ${index === 0 ? "border-t" : ""}`}
                      onClick={() => onOpenLeadDetails(lead.id)}
                      draggable={isStageGrouping}
                      onDragStart={() => onLeadDragStart(lead.id)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-base font-semibold leading-tight text-slate-900">
                            {lead.title || lead.clientName || "Opportunity"}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-slate-700"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditLead(lead)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => onRequestDelete([lead.id])}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className="mt-0.5 text-sm font-semibold text-slate-800">
                        {lead.value != null ? currency.format(lead.value) : "-"}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-600">{lead.email || "-"}</p>

                      <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1">
                        <div className="relative flex items-center gap-1">
                          {[1, 2, 3].map((level) => (
                            <Star
                              key={level}
                              className={`h-3.5 w-3.5 ${level <= (lead.probabilityLevel ?? 1) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                            />
                          ))}
                          <button
                            type="button"
                            draggable={false}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onToggleActivityCard(lead.id);
                            }}
                            className="ml-1 rounded p-0.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            title="Schedule activity"
                            aria-label="Schedule activity"
                          >
                            <Clock3 className="h-3.5 w-3.5" />
                          </button>
                          {activityOpenLeadId === lead.id ? (
                            <div className="absolute left-6 top-full z-20 mt-2 w-[250px] overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
                              <div className="bg-white px-3 py-4 text-center italic text-sm text-slate-500">
                                Schedule activities to help you get things done.
                              </div>
                              <button
                                type="button"
                                draggable={false}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  onScheduleActivity(lead);
                                }}
                                className="flex w-full items-center justify-center gap-2 border-t border-slate-300 bg-slate-100 px-3 py-3 text-base font-semibold text-slate-900 transition hover:bg-slate-200"
                              >
                                <Plus className="h-4 w-4" />
                                <span>Schedule an activity</span>
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          draggable={false}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={() => onShowSalespersonLead(lead)}
                          className={`flex h-6 w-6 items-center justify-center rounded-md ${getLeadAvatarColorClass(
                            lead.createdByName || lead.createdByEmail || ""
                          )} text-[10px] font-semibold uppercase text-white transition hover:brightness-95`}
                          title={lead.createdByName || lead.createdByEmail || "Unknown"}
                        >
                          {(lead.createdByName || lead.createdByEmail || "U").trim().charAt(0)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        })}

        {isStageGrouping ? (
          <div className="sticky top-0 right-0 z-20 flex w-10 shrink-0 self-start items-start justify-center bg-transparent">
            {showAddStageInput ? (
              <div
                ref={addStagePanelRef}
                className="absolute left-full top-0 w-[250px] border border-slate-400 bg-slate-100 shadow-sm"
              >
                <div className="border-b border-slate-400 bg-slate-100 p-2.5">
                  <p className="text-lg font-semibold tracking-tight text-slate-900">New Stage</p>
                  <p className="mt-1 text-xs text-slate-500">Create a new pipeline stage</p>
                </div>
                <div className="space-y-2 p-2">
                  <Input
                    value={newStageLabel}
                    onChange={(event) => onNewStageLabelChange(event.target.value)}
                    placeholder="Stage name..."
                    className="h-9 bg-white"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={onConfirmAddStage} className="h-8 px-3">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={onCancelAddStage} className="h-8 px-3">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={onShowAddStageInput}
                className="group flex h-full min-h-[220px] w-10 flex-col items-center justify-start gap-2 rounded-none bg-gradient-to-b from-slate-100 via-slate-50 to-white px-0 pt-1 text-sky-500 hover:from-slate-100 hover:via-slate-50 hover:to-white hover:text-sky-600"
              >
                <ChevronsRight className="h-4 w-4" />
                <span className="[writing-mode:vertical-rl] rotate-180 text-base leading-none tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                  Add Stage
                </span>
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
