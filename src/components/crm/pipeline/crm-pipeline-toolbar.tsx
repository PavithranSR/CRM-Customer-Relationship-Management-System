import type { FormEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  Columns2,
  List,
  MapPin,
  Settings,
  Table,
  TimerReset,
} from "lucide-react";
import type { LeadStage } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CrmPipelineCreateLeadDialog } from "./crm-pipeline-create-lead-dialog";
import { CrmPipelineToolbarSearch } from "./crm-pipeline-toolbar-search";
import type {
  CrmPipelineProps,
  GroupByDate,
  GroupByField,
  SearchChip,
  SortMode,
  ViewMode,
  VisibleStage,
} from "./crm-pipeline-types";

export interface CrmPipelineToolbarProps {
  isPending: boolean;
  clients: CrmPipelineProps["clients"];
  showCreate: boolean;
  onShowCreateChange: (open: boolean) => void;
  onCreateLead: (formData: FormData) => Promise<void>;
  newClientName: string;
  newEmail: string;
  newPhone: string;
  newValue: string;
  newProbabilityLevel: 1 | 2 | 3;
  newNotes: string;
  onClientNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onProbabilityChange: (value: 1 | 2 | 3) => void;
  onNotesChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (viewMode: ViewMode) => void;
  showStats: boolean;
  onToggleStats: () => void;
  onOpenReporting: () => void;
  onOpenMap: () => void;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  activeSearchChips: SearchChip[];
  onRemoveActiveChip: (chipId: string) => void;
  visibleStages: VisibleStage[];
  stageFilters: LeadStage[];
  onStageFilterChange: (stageKey: LeadStage, checked: boolean) => void;
  onOpenCustomFilterDialog: () => void;
  onClearStageFilters: () => void;
  myPipelineOnly: boolean;
  onToggleMyPipeline: () => void;
  unassignedOnly: boolean;
  onToggleUnassigned: () => void;
  openOpportunitiesOnly: boolean;
  onToggleOpenOpportunities: () => void;
  groupByField: GroupByField;
  onGroupByFieldChange: (value: GroupByField) => void;
  groupByDate: GroupByDate;
  onGroupByDateChange: (value: GroupByDate) => void;
  sortMode: SortMode;
  onSortModeChange: (value: SortMode) => void;
  onClearAllSearchOptions: () => void;
  onOpenArchivePage: () => void;
  onOpenDeletedPage: () => void;
  visibleSelectedCount: number;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
}

export function CrmPipelineToolbar({
  isPending,
  clients,
  showCreate,
  onShowCreateChange,
  onCreateLead,
  newClientName,
  newEmail,
  newPhone,
  newValue,
  newProbabilityLevel,
  newNotes,
  onClientNameChange,
  onEmailChange,
  onPhoneChange,
  onValueChange,
  onProbabilityChange,
  onNotesChange,
  viewMode,
  onViewModeChange,
  showStats,
  onToggleStats,
  onOpenReporting,
  onOpenMap,
  onRefresh,
  search,
  onSearchChange,
  onSearchSubmit,
  activeSearchChips,
  onRemoveActiveChip,
  visibleStages,
  stageFilters,
  onStageFilterChange,
  onOpenCustomFilterDialog,
  onClearStageFilters,
  myPipelineOnly,
  onToggleMyPipeline,
  unassignedOnly,
  onToggleUnassigned,
  openOpportunitiesOnly,
  onToggleOpenOpportunities,
  groupByField,
  onGroupByFieldChange,
  groupByDate,
  onGroupByDateChange,
  sortMode,
  onSortModeChange,
  onClearAllSearchOptions,
  onOpenArchivePage,
  onOpenDeletedPage,
  visibleSelectedCount,
  onBulkArchive,
  onBulkDelete,
}: CrmPipelineToolbarProps) {
  return (
    <div className="sticky top-0 z-20 w-full shrink-0 grid gap-2 rounded-xl border bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/90 lg:grid-cols-[auto_minmax(340px,1fr)_auto] lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <CrmPipelineCreateLeadDialog
          clients={clients}
          isPending={isPending}
          open={showCreate}
          onOpenChange={onShowCreateChange}
          onSubmit={onCreateLead}
          newClientName={newClientName}
          newEmail={newEmail}
          newPhone={newPhone}
          newValue={newValue}
          newProbabilityLevel={newProbabilityLevel}
          newNotes={newNotes}
          onClientNameChange={onClientNameChange}
          onEmailChange={onEmailChange}
          onPhoneChange={onPhoneChange}
          onValueChange={onValueChange}
          onProbabilityChange={onProbabilityChange}
          onNotesChange={onNotesChange}
        />

        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Pipeline</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={onOpenArchivePage}>Archive Page</DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenDeletedPage}>Deleted Page</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CrmPipelineToolbarSearch
        isPending={isPending}
        viewMode={viewMode}
        visibleSelectedCount={visibleSelectedCount}
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
        search={search}
        onSearchChange={onSearchChange}
        onSearchSubmit={onSearchSubmit}
        activeSearchChips={activeSearchChips}
        onRemoveActiveChip={onRemoveActiveChip}
        visibleStages={visibleStages}
        stageFilters={stageFilters}
        onStageFilterChange={onStageFilterChange}
        onOpenCustomFilterDialog={onOpenCustomFilterDialog}
        onClearStageFilters={onClearStageFilters}
        myPipelineOnly={myPipelineOnly}
        onToggleMyPipeline={onToggleMyPipeline}
        unassignedOnly={unassignedOnly}
        onToggleUnassigned={onToggleUnassigned}
        openOpportunitiesOnly={openOpportunitiesOnly}
        onToggleOpenOpportunities={onToggleOpenOpportunities}
        groupByField={groupByField}
        onGroupByFieldChange={onGroupByFieldChange}
        groupByDate={groupByDate}
        onGroupByDateChange={onGroupByDateChange}
        sortMode={sortMode}
        onSortModeChange={onSortModeChange}
        onClearAllSearchOptions={onClearAllSearchOptions}
      />

      <div className="flex flex-wrap items-center gap-2 lg:justify-self-end">
        <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-200">
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none border-r border-slate-300"
            onClick={() => onViewModeChange("kanban")}
            title="Kanban view"
            aria-label="Kanban view"
          >
            <Columns2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none"
            onClick={() => onViewModeChange("list")}
            title="List view"
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex overflow-hidden rounded-md border border-slate-300 bg-slate-100">
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none border-r border-slate-300"
            onClick={() => onViewModeChange("calendar")}
            title="Calendar view"
            aria-label="Calendar view"
          >
            <CalendarDays className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-none border-r border-slate-300"
            onClick={onOpenReporting}
            title="Open reporting"
            aria-label="Open reporting"
          >
            <Table className="h-4 w-4" />
          </Button>
          <Button
            variant={showStats ? "default" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-none border-r border-slate-300"
            onClick={onToggleStats}
            title="Toggle analytics"
            aria-label="Toggle analytics"
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-none border-r border-slate-300"
            onClick={onOpenMap}
            title="Open map"
            aria-label="Open map"
          >
            <MapPin className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-none"
            onClick={onRefresh}
            title="Refresh page"
            aria-label="Refresh page"
          >
            <TimerReset className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
