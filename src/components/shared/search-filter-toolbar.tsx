"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Filter, LayoutGrid, List, Search, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SearchFilterOption {
  value: string;
  label: string;
}

interface SavedSearchItem {
  id: string;
  label: string;
}

interface ActiveChip {
  id: string;
  label: string;
  kind: "filter" | "group";
}

interface SearchFilterToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  selectedFilters: string[];
  filterOptions: SearchFilterOption[];
  onToggleFilter: (value: string) => void;
  activeChips: ActiveChip[];
  onRemoveChip: (id: string, kind: ActiveChip["kind"]) => void;
  groupByValue: string;
  groupByOptions: SearchFilterOption[];
  onGroupByChange: (value: string) => void;
  onClearAll: () => void;
  onSaveSearch: () => void;
  savedSearches: SavedSearchItem[];
  onApplySavedSearch: (id: string) => void;
  viewMode?: "list" | "kanban";
  onViewModeChange?: (value: "list" | "kanban") => void;
  groupByExtraContent?: ReactNode;
  expandedGroupKey?: string | null;
  onExpandedGroupChange?: (value: string | null) => void;
  renderExpandedGroupContent?: (value: string) => ReactNode;
  popoverContentClassName?: string;
}

export function SearchFilterToolbar({
  query,
  onQueryChange,
  placeholder = "Search...",
  isMenuOpen,
  onMenuOpenChange,
  selectedFilters,
  filterOptions,
  onToggleFilter,
  activeChips,
  onRemoveChip,
  groupByValue,
  groupByOptions,
  onGroupByChange,
  onClearAll,
  onSaveSearch,
  savedSearches,
  onApplySavedSearch,
  viewMode,
  onViewModeChange,
  groupByExtraContent,
  expandedGroupKey,
  onExpandedGroupChange,
  renderExpandedGroupContent,
  popoverContentClassName,
}: SearchFilterToolbarProps) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-3">
        <Popover open={isMenuOpen} onOpenChange={onMenuOpenChange}>
          <PopoverAnchor asChild>
            <div className="flex min-h-11 w-full items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div
                className={cn(
                  "flex min-h-11 min-w-0 flex-1 gap-2 overflow-hidden px-3 sm:px-4",
                  activeChips.length > 0 ? "items-start py-1.5" : "items-center"
                )}
              >
                <Search
                  className={cn(
                    "h-4 w-4 shrink-0 text-slate-400",
                    activeChips.length > 0 ? "mt-2" : "self-center"
                  )}
                />
                <div
                  className={cn(
                    "min-w-0 flex-1",
                    activeChips.length > 0 ? "flex flex-wrap items-center gap-2 py-0.5" : ""
                  )}
                >
                  {activeChips.map((chip) => (
                    <span
                      key={chip.id}
                      className="inline-flex h-7 max-w-full shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-[11px] text-slate-700"
                    >
                      <span
                        className={cn(
                          "inline-flex w-7 shrink-0 items-center justify-center",
                          chip.kind === "filter" ? "bg-rose-700 text-white" : "bg-teal-700 text-white"
                        )}
                      >
                        {chip.kind === "filter" ? <Filter className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />}
                      </span>
                      <span className="flex min-w-0 items-center gap-1 px-2">
                        <span className="max-w-[210px] truncate whitespace-nowrap sm:max-w-[280px]">
                          {chip.label}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRemoveChip(chip.id, chip.kind);
                          }}
                          className="shrink-0 rounded-sm p-0.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                          aria-label={`Clear ${chip.label}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </span>
                  ))}
                  <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    onFocus={() => onMenuOpenChange?.(true)}
                    placeholder={placeholder}
                    className={cn(
                      "border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0",
                      activeChips.length > 0
                        ? "h-8 min-w-[160px] w-auto flex-[1_1_160px] rounded-none"
                        : "h-11 min-w-[140px] w-full flex-1 sm:min-w-[160px]"
                    )}
                  />
                </div>
              </div>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex min-h-11 w-[54px] shrink-0 items-center justify-center self-stretch border-l border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
                  aria-label="Open search filters"
                >
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </PopoverTrigger>
            </div>
          </PopoverAnchor>
          <PopoverContent
            align="center"
            className={cn("w-[min(560px,calc(100vw-1rem))] overflow-hidden p-0", popoverContentClassName)}
          >
            <div className="max-h-[min(520px,calc(100vh-6rem))] overflow-y-auto md:overflow-hidden">
              <div className="grid grid-cols-1 md:h-[min(520px,calc(100vh-6rem))] md:grid-cols-3">
                <div className="flex min-h-0 flex-col p-3 md:border-r md:border-slate-200">
                  <div className="mb-3 flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-rose-700" />
                    <h3 className="text-xl font-semibold text-slate-900">Filters</h3>
                  </div>
                  <div className="space-y-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => onToggleFilter(option.value)}
                        className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                          selectedFilters.includes(option.value) ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>{option.label}</span>
                        {selectedFilters.includes(option.value) ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col border-t border-slate-200 p-3 md:border-r md:border-t-0 md:border-slate-200">
                  <div className="mb-3 flex items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5 text-teal-700" />
                    <h3 className="text-xl font-semibold text-slate-900">Group By</h3>
                  </div>
                  <div className="space-y-1 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                    {groupByOptions.map((option) => {
                      const expandedContent = renderExpandedGroupContent?.(option.value);

                      return (
                        <div key={option.value}>
                          <button
                            type="button"
                            onClick={() => {
                              const hasExpandedContent = Boolean(expandedContent);
                              onGroupByChange(option.value);
                              if (!onExpandedGroupChange) return;
                              if (!hasExpandedContent) {
                                onExpandedGroupChange(null);
                                return;
                              }
                              onExpandedGroupChange(expandedGroupKey === option.value ? null : option.value);
                            }}
                            className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                              groupByValue === option.value ? "bg-slate-100 font-semibold text-slate-900" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{option.label}</span>
                            <span className="flex items-center gap-2">
                              {expandedContent ? (
                                expandedGroupKey === option.value ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                                )
                              ) : null}
                              {groupByValue === option.value ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                          </button>
                          {expandedGroupKey === option.value && expandedContent ? (
                            <div className="ml-4 mt-1 border-l border-slate-200 pl-3">
                              {expandedContent}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {groupByExtraContent ? (
                      <div className="mt-4 border-t border-slate-200 pt-4">
                        {groupByExtraContent}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex min-h-0 flex-col border-t border-slate-200 p-3 md:border-t-0">
                  <div className="mb-3 flex items-center gap-2">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <h3 className="text-xl font-semibold text-slate-900">Favorites</h3>
                  </div>
                  <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:pr-1">
                    <Button type="button" variant="outline" className="h-9 w-full justify-start text-sm" onClick={onSaveSearch}>
                      Save current search
                    </Button>
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="block w-full border-t border-slate-200 pt-3 text-left text-sm text-slate-700 hover:text-slate-900"
                    >
                      Clear all search options
                    </button>
                    {savedSearches.length > 0 ? (
                      <div className="border-t border-slate-200 pt-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Saved Searches</p>
                        <div className="space-y-1">
                          {savedSearches.map((searchItem) => (
                            <button
                              key={searchItem.id}
                              type="button"
                              onClick={() => onApplySavedSearch(searchItem.id)}
                              className="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              {searchItem.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {viewMode && onViewModeChange ? (
        <div className="inline-flex items-center self-start rounded-md border border-slate-300 bg-slate-50 p-1 xl:self-auto">
          <button
            type="button"
            onClick={() => onViewModeChange("kanban")}
            className={`inline-flex h-9 w-11 items-center justify-center rounded-md ${
              viewMode === "kanban" ? "bg-[#2b6cb0] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="Kanban view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`inline-flex h-9 w-11 items-center justify-center rounded-md ${
              viewMode === "list" ? "bg-[#2b6cb0] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
