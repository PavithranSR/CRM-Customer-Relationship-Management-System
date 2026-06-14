import type { RefObject } from "react";
import type { CrmLeadItem, LeadStage } from "@/actions/crm.actions";
import { CrmPipelineCalendarView } from "./crm-pipeline-calendar-view";
import { CrmPipelineKanbanBoard } from "./crm-pipeline-kanban-board";
import { CrmPipelineListView } from "./crm-pipeline-list-view";
import type { GroupedPipelineStage, StageTheme, ViewMode } from "./crm-pipeline-types";

export interface CrmPipelineContentProps {
  viewMode: ViewMode;
  showStats: boolean;
  groupedBySelectedField: GroupedPipelineStage[];
  clients: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }[];
  allLeadsSelected: boolean;
  filteredLeads: CrmLeadItem[];
  orderedLeads: CrmLeadItem[];
  visibleSelectedLeadIds: string[];
  calendarDate: Date;
  calendarLeadId: string | null;
  stageLabels: Record<string, string>;
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
  onToggleAllLeadsSelection: (checked: boolean) => void;
  onToggleLeadSelection: (leadId: string, checked: boolean) => void;
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
  onCalendarDateChange: (date: Date) => void;
  onShowSalespersonLead: (lead: CrmLeadItem) => void;
}

function CrmPipelineStats({ groups }: { groups: GroupedPipelineStage[] }) {
  return (
    <div className="grid shrink-0 gap-2 md:grid-cols-4">
      {groups.map((stage) => (
        <div key={stage.key} className="rounded border bg-white p-3">
          <p className="text-sm text-muted-foreground">{stage.label}</p>
          <p className="text-2xl font-semibold">{stage.items.length}</p>
        </div>
      ))}
    </div>
  );
}

export function CrmPipelineContent(props: CrmPipelineContentProps) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      {props.showStats ? <CrmPipelineStats groups={props.groupedBySelectedField} /> : null}

      {props.viewMode === "kanban" ? (
        <CrmPipelineKanbanBoard
          groupedBySelectedField={props.groupedBySelectedField}
          currency={props.currency}
          shortCurrency={props.shortCurrency}
          isStageGrouping={props.isStageGrouping}
          foldedStages={props.foldedStages}
          stageThemeByKey={props.stageThemeByKey}
          draggingLeadId={props.draggingLeadId}
          dragOverStage={props.dragOverStage}
          editingStageKey={props.editingStageKey}
          editingStageLabel={props.editingStageLabel}
          showAddStageInput={props.showAddStageInput}
          newStageLabel={props.newStageLabel}
          activityOpenLeadId={props.activityOpenLeadId}
          kanbanScrollRef={props.kanbanScrollRef}
          addStagePanelRef={props.addStagePanelRef}
          onOpenLeadDetails={props.onOpenLeadDetails}
          onEditLead={props.onEditLead}
          onRequestDelete={props.onRequestDelete}
          onOpenCreate={props.onOpenCreate}
          onShowAddStageInput={props.onShowAddStageInput}
          onStageDragStart={props.onStageDragStart}
          onLeadDragStart={props.onLeadDragStart}
          onDragEnd={props.onDragEnd}
          onStageDragOver={props.onStageDragOver}
          onKanbanDragOver={props.onKanbanDragOver}
          onStageDragLeave={props.onStageDragLeave}
          onStageDrop={props.onStageDrop}
          onEditingStageLabelChange={props.onEditingStageLabelChange}
          onSaveStageLabel={props.onSaveStageLabel}
          onCancelEditStage={props.onCancelEditStage}
          onStartEditStage={props.onStartEditStage}
          onToggleFoldStage={props.onToggleFoldStage}
          onRequestDeleteStage={props.onRequestDeleteStage}
          onNewStageLabelChange={props.onNewStageLabelChange}
          onConfirmAddStage={props.onConfirmAddStage}
          onCancelAddStage={props.onCancelAddStage}
          onToggleActivityCard={props.onToggleActivityCard}
          onScheduleActivity={props.onScheduleActivity}
          onShowSalespersonLead={props.onShowSalespersonLead}
        />
      ) : props.viewMode === "calendar" ? (
        <CrmPipelineCalendarView
          orderedLeads={props.orderedLeads}
          stageLabels={props.stageLabels}
          selectedDate={props.calendarDate}
          highlightedLeadId={props.calendarLeadId}
          onSelectedDateChange={props.onCalendarDateChange}
          onOpenLeadDetails={props.onOpenLeadDetails}
        />
      ) : (
        <CrmPipelineListView
          clients={props.clients}
          allLeadsSelected={props.allLeadsSelected}
          filteredLeads={props.filteredLeads}
          orderedLeads={props.orderedLeads}
          visibleSelectedLeadIds={props.visibleSelectedLeadIds}
          stageLabels={props.stageLabels}
          currency={props.currency}
          onToggleAllLeadsSelection={props.onToggleAllLeadsSelection}
          onToggleLeadSelection={props.onToggleLeadSelection}
          onOpenLeadDetails={props.onOpenLeadDetails}
          onEditLead={props.onEditLead}
          onRequestDelete={props.onRequestDelete}
        />
      )}
    </div>
  );
}
