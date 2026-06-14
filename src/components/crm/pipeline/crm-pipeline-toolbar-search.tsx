import type { FormEvent } from "react";
import { ChevronDown, Funnel, Layers3, Search, Star } from "lucide-react";
import { toast } from "sonner";
import type { LeadStage } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GroupByDate, GroupByField, SearchChip, SortMode, ViewMode, VisibleStage } from "./crm-pipeline-types";

export interface CrmPipelineToolbarSearchProps {
  isPending: boolean;
  viewMode: ViewMode;
  visibleSelectedCount: number;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
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
}

export function CrmPipelineToolbarSearch({
  isPending,
  viewMode,
  visibleSelectedCount,
  onBulkArchive,
  onBulkDelete,
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
}: CrmPipelineToolbarSearchProps) {
  return (
    <div className="flex justify-center lg:w-full lg:justify-self-center">
      {visibleSelectedCount > 0 && viewMode === "list" ? (
        <div className="flex w-full max-w-[620px] items-center justify-between rounded-md border bg-background px-3 py-1.5">
          <span className="text-sm font-semibold text-foreground">{visibleSelectedCount} selected</span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={onBulkArchive}>
              Archive
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-danger text-white hover:bg-danger/90"
              onClick={onBulkDelete}
              disabled={isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSearchSubmit} className="flex w-full max-w-[760px] overflow-hidden rounded-xl shadow-sm">
          <div className="flex min-h-11 w-full border border-r-0 border-slate-300 bg-white">
            <div
              className={cn(
                "flex min-h-11 min-w-0 flex-1 gap-2 px-3",
                activeSearchChips.length > 0 ? "items-start py-1.5" : "items-center"
              )}
            >
              <Search
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground",
                  activeSearchChips.length > 0 ? "mt-2" : "self-center"
                )}
              />
              <div
                className={cn(
                  "min-w-0 flex-1",
                  activeSearchChips.length > 0 ? "flex flex-wrap items-center gap-2 py-0.5" : ""
                )}
              >
                {activeSearchChips.map((chip) => {
                  const isGroupChip = chip.id === "group_by";

                  return (
                    <span
                      key={chip.id}
                      className="inline-flex h-7 max-w-full shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-[11px] text-slate-700"
                    >
                      <span
                        className={cn(
                          "inline-flex w-7 shrink-0 items-center justify-center text-white",
                          isGroupChip ? "bg-teal-700" : "bg-rose-700"
                        )}
                      >
                        {isGroupChip ? <Layers3 className="h-3 w-3" /> : <Funnel className="h-3 w-3" />}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 px-2">
                        <span className="max-w-[210px] truncate whitespace-nowrap sm:max-w-[280px]">{chip.label}</span>
                        <button
                          type="button"
                          className="shrink-0 rounded-sm p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                          onClick={() => onRemoveActiveChip(chip.id)}
                          aria-label={`Remove ${chip.label}`}
                        >
                          x
                        </button>
                      </span>
                    </span>
                  );
                })}
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search..."
                  className={cn(
                    "border-0 bg-transparent text-sm outline-none",
                    activeSearchChips.length > 0
                      ? "h-8 min-w-[120px] w-auto flex-[1_1_140px]"
                      : "h-11 min-w-20 w-full flex-1"
                  )}
                />
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex min-h-11 w-[54px] shrink-0 items-center justify-center self-stretch border border-slate-300 border-l-0 bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[780px] max-w-[95vw] overflow-hidden p-0">
              <div className="max-h-[min(520px,calc(100vh-6rem))] overflow-y-auto md:overflow-hidden">
                <div className="grid grid-cols-1 md:h-[min(520px,calc(100vh-6rem))] md:grid-cols-3">
                  <div className="flex min-h-0 flex-col p-4 md:border-r">
                    <div className="flex items-center gap-2">
                      <Funnel className="h-4 w-4 text-secondary" />
                      <p className="text-2xl font-semibold">Filters</p>
                    </div>
                    <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${myPipelineOnly ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={onToggleMyPipeline}
                      >
                        My Pipeline
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${unassignedOnly ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={onToggleUnassigned}
                      >
                        Unassigned
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${openOpportunitiesOnly ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={onToggleOpenOpportunities}
                      >
                        Open Opportunities
                      </button>
                      <div className="border-t pt-2">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${sortMode === "oldest" ? "bg-slate-100" : ""}`}
                          onClick={() => onSortModeChange("oldest")}
                        >
                          <span>Creation Date</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${sortMode === "recent" ? "bg-slate-100" : ""}`}
                          onClick={() => onSortModeChange("recent")}
                        >
                          <span>Closed Date</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-t pt-2">
                        {visibleStages.map((stage) => (
                          <DropdownMenuCheckboxItem
                            key={stage.key}
                            checked={stageFilters.includes(stage.key)}
                            onSelect={(event) => event.preventDefault()}
                            onCheckedChange={(checked) => onStageFilterChange(stage.key, Boolean(checked))}
                          >
                            {stage.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </div>
                      <div className="border-t pt-2">
                        <DropdownMenuItem onClick={onOpenCustomFilterDialog}>Custom Filter...</DropdownMenuItem>
                        <DropdownMenuItem onClick={onClearStageFilters}>Clear stage filters</DropdownMenuItem>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col p-4 md:border-r">
                    <div className="flex items-center gap-2">
                      <Layers3 className="h-4 w-4 text-teal-700" />
                      <p className="text-2xl font-semibold">Group By</p>
                    </div>
                    <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "salesperson" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("salesperson")}
                      >
                        Salesperson
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "sales_team" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("sales_team")}
                      >
                        Sales Team
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "stage" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("stage")}
                      >
                        Stage
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "city" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("city")}
                      >
                        City
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "country" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("country")}
                      >
                        Country
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "lost_reason" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("lost_reason")}
                      >
                        Lost Reason
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "campaign" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("campaign")}
                      >
                        Campaign
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "medium" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("medium")}
                      >
                        Medium
                      </button>
                      <button
                        type="button"
                        className={`block w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByField === "source" ? "bg-slate-100 font-semibold" : ""}`}
                        onClick={() => onGroupByFieldChange("source")}
                      >
                        Source
                      </button>
                      <div className="border-t pt-2">
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByDate === "creation" ? "bg-slate-100 font-semibold" : ""}`}
                          onClick={() => onGroupByDateChange("creation")}
                        >
                          <span>Creation Date</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByDate === "expected_closing" ? "bg-slate-100 font-semibold" : ""}`}
                          onClick={() => onGroupByDateChange("expected_closing")}
                        >
                          <span>Expected Closing</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100 ${groupByDate === "closed_date" ? "bg-slate-100 font-semibold" : ""}`}
                          onClick={() => onGroupByDateChange("closed_date")}
                        >
                          <span>Closed Date</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-t pt-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100"
                          onClick={() => toast.info("Properties will be available soon")}
                        >
                          <span>Properties</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="border-t pt-2">
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-slate-100"
                          onClick={() => toast.info("Custom group will be available soon")}
                        >
                          <span>Custom Group</span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col p-4">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                      <p className="text-2xl font-semibold">Favorites</p>
                    </div>
                    <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                      <button
                        type="button"
                        className="w-full rounded border bg-slate-100 px-3 py-2 text-left hover:bg-slate-200"
                        onClick={() => toast.success("Current search saved as favorite")}
                      >
                        Save current search
                      </button>
                      <div className="border-t pt-2">
                        <DropdownMenuItem onClick={onClearAllSearchOptions}>Clear all search options</DropdownMenuItem>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </form>
      )}
    </div>
  );
}
