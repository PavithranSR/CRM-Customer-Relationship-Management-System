"use client";

import type { ComponentProps } from "react";
import { LayoutGrid, List, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProjectSearchFilterBar } from "@/components/projects/project-search-filter-bar";
import { EmployeeAssigneeInput } from "@/components/projects/admin-project-task-monitor-parts/employee-assignee-input";
import { type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";

interface BoardToolbarProps {
  activeFilter: ComponentProps<typeof ProjectSearchFilterBar>["activeFilter"];
  activeGroupBy: ComponentProps<typeof ProjectSearchFilterBar>["activeGroupBy"];
  boardSearch: string;
  employeeAssignments: TeamPerson[];
  projectId: string;
  hasActiveToolbarFilters: boolean;
  isSavingTask: boolean;
  isSearchMenuOpen: boolean;
  onAddTask: () => void | Promise<void>;
  onActiveFilterChange: ComponentProps<typeof ProjectSearchFilterBar>["onActiveFilterChange"];
  onActiveGroupByChange: ComponentProps<typeof ProjectSearchFilterBar>["onActiveGroupByChange"];
  onBoardSearchChange: (value: string) => void;
  onOpenQuickAddTaskCard: () => void;
  onResetFilters: () => void;
  onSearchMenuOpenChange: (open: boolean) => void;
  onClearTaskAssignee: () => void;
  onSelectTaskAssignee: (employee: TeamPerson) => void;
  onTaskAssigneeQueryChange: (value: string) => void;
  setTaskTitle: (value: string) => void;
  setViewMode: (value: "kanban" | "list") => void;
  showQuickAddTaskCard: boolean;
  taskAssigneeQuery: string;
  taskFilterConfig: ComponentProps<typeof ProjectSearchFilterBar>["taskFilterConfig"];
  taskTitle: string;
  viewMode: "kanban" | "list";
  onCloseQuickAddTaskCard: () => void;
}

export function BoardToolbar({
  activeFilter,
  activeGroupBy,
  boardSearch,
  employeeAssignments,
  projectId,
  hasActiveToolbarFilters,
  isSavingTask,
  isSearchMenuOpen,
  onAddTask,
  onActiveFilterChange,
  onActiveGroupByChange,
  onBoardSearchChange,
  onCloseQuickAddTaskCard,
  onOpenQuickAddTaskCard,
  onResetFilters,
  onSearchMenuOpenChange,
  onClearTaskAssignee,
  onSelectTaskAssignee,
  onTaskAssigneeQueryChange,
  setTaskTitle,
  setViewMode,
  showQuickAddTaskCard,
  taskAssigneeQuery,
  taskFilterConfig,
  taskTitle,
  viewMode,
}: BoardToolbarProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-col gap-2.5 xl:grid xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center xl:gap-3">
        <div className="relative flex shrink-0 items-center">
          <Button
            type="button"
            className="h-9 shrink-0 bg-[#44a2de] px-4 text-white hover:bg-[#3991ca]"
            onClick={onOpenQuickAddTaskCard}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>

          {showQuickAddTaskCard ? (
            <Card className="absolute left-0 top-[calc(100%+0.75rem)] z-30 w-[340px] rounded-2xl border-slate-200 bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.28)]">
              <CardContent className="space-y-4 p-4">
                <div className="space-y-2">
                  <Label htmlFor="quick-admin-task-title" className="text-sm font-semibold text-slate-900">
                    Task Title
                  </Label>
                  <Input
                    id="quick-admin-task-title"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="e.g. Send Invitations"
                    disabled={isSavingTask}
                    className="rounded-none border-0 border-b border-slate-300 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-slate-900">Assignee (optional)</Label>
                  <EmployeeAssigneeInput
                    inputId="quick-admin-task-assignee"
                    projectId={projectId}
                    employees={employeeAssignments}
                    value={taskAssigneeQuery}
                    onValueChange={onTaskAssigneeQueryChange}
                    onEmployeePick={onSelectTaskAssignee}
                    onClearSelection={onClearTaskAssignee}
                    placeholder="Type team leader or team member"
                    disabled={isSavingTask}
                    className="border-slate-200 bg-white text-slate-900"
                  />
                  {employeeAssignments.length === 0 ? (
                    <p className="text-xs text-slate-500">No project team members available</p>
                  ) : (
                    <p className="text-xs text-slate-500">Only the assigned team leader and project team members can be selected.</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="bg-[#7c4a69] text-white hover:bg-[#6d3f5c]"
                      onClick={() => void onAddTask()}
                      disabled={isSavingTask}
                    >
                      {isSavingTask ? "Adding..." : "Add"}
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    onClick={onCloseQuickAddTaskCard}
                    disabled={isSavingTask}
                    aria-label="Close add task card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 items-center justify-center xl:px-2">
          <div className={`w-full ${hasActiveToolbarFilters ? "max-w-[920px]" : "max-w-[680px]"}`}>
            <ProjectSearchFilterBar
              mode="allTasks"
              searchQuery={boardSearch}
              onSearchQueryChange={onBoardSearchChange}
              isSearchMenuOpen={isSearchMenuOpen}
              onSearchMenuOpenChange={onSearchMenuOpenChange}
              activeFilter={activeFilter}
              onActiveFilterChange={onActiveFilterChange}
              activeGroupBy={activeGroupBy}
              onActiveGroupByChange={onActiveGroupByChange}
              onReset={onResetFilters}
              taskFilterConfig={taskFilterConfig}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end">
          <div className="inline-flex h-9 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("kanban")}
              className={`h-9 w-9 rounded-none ${
                viewMode === "kanban"
                  ? "bg-cyan-50 text-[#144a7d] shadow-[inset_0_0_0_1px_#00e5ff]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-label="Kanban view"
              title="Kanban view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setViewMode("list")}
              className={`h-9 w-9 rounded-none border-l border-slate-200 ${
                viewMode === "list"
                  ? "bg-cyan-50 text-[#144a7d] shadow-[inset_0_0_0_1px_#00e5ff]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              aria-label="List view"
              title="List view"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
