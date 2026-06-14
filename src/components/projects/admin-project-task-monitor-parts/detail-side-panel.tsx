"use client";

import type { ReactNode, RefObject } from "react";
import { Funnel, Paperclip, Search, SmilePlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TaskAssigneePopoverContent } from "@/components/projects/admin-project-task-monitor-parts/task-assignee-popover-content";
import {
  getEmployeeAvatarLetter,
  type EmojiOption,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";
import type { ProjectTask } from "@/lib/project-task-utils";

interface DetailSidePanelProps {
  activeSidePanel: "messages" | "log" | "activity";
  assigningTaskId: string | null;
  employeeAssignments: TeamPerson[];
  emojiCategory: EmojiOption["category"];
  emojiPickerRef: RefObject<HTMLDivElement | null>;
  emojiSearch: string;
  filteredEmojiResults: EmojiOption[];
  isSendingMessage: boolean;
  messagesContent: ReactNode;
  activityContent: ReactNode;
  messageText: string;
  normalizedTaskSearch: string;
  onActiveSidePanelChange: (value: "messages" | "log" | "activity") => void;
  onAssignEmployeeToTask: (task: ProjectTask, assigneeId: string) => void | Promise<void>;
  onEmojiCategoryChange: (value: EmojiOption["category"]) => void;
  onEmojiSearchChange: (value: string) => void;
  onMessageTextChange: (value: string) => void;
  onOpenTaskEmployeeProfile: (task: ProjectTask, employee: TeamPerson) => void;
  onSelectedAttachmentNameChange: (value: string) => void;
  onSendTaskMessage: () => void;
  onSetShowEmojiPicker: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetShowTaskSearch: (value: boolean) => void;
  onSetShowTaskSearchFilter: (value: boolean | ((current: boolean) => boolean)) => void;
  onSetTaskAssigneePopoverTaskId: (value: string | null) => void;
  onTaskSearchFilterChange: (value: "all" | "conversations" | "tracked") => void;
  onTaskSearchTextChange: (value: string) => void;
  selectedAttachmentName: string;
  selectedTask: ProjectTask;
  showEmojiPicker: boolean;
  showTaskSearch: boolean;
  showTaskSearchFilter: boolean;
  standaloneTaskPage: boolean;
  taskAssignee: TeamPerson | null;
  taskAssigneePopoverTaskId: string | null;
  taskSearchFilter: "all" | "conversations" | "tracked";
  taskSearchText: string;
  attachmentInputRef: RefObject<HTMLInputElement | null>;
}

export function DetailSidePanel({
  activeSidePanel,
  activityContent,
  assigningTaskId,
  attachmentInputRef,
  employeeAssignments,
  emojiCategory,
  emojiPickerRef,
  emojiSearch,
  filteredEmojiResults,
  isSendingMessage,
  messageText,
  messagesContent,
  onActiveSidePanelChange,
  onAssignEmployeeToTask,
  onEmojiCategoryChange,
  onEmojiSearchChange,
  onMessageTextChange,
  onOpenTaskEmployeeProfile,
  onSelectedAttachmentNameChange,
  onSendTaskMessage,
  onSetShowEmojiPicker,
  onSetShowTaskSearch,
  onSetShowTaskSearchFilter,
  onSetTaskAssigneePopoverTaskId,
  onTaskSearchFilterChange,
  onTaskSearchTextChange,
  selectedAttachmentName,
  selectedTask,
  showEmojiPicker,
  showTaskSearch,
  showTaskSearchFilter,
  standaloneTaskPage,
  taskAssignee,
  taskAssigneePopoverTaskId,
  taskSearchFilter,
  taskSearchText,
}: DetailSidePanelProps) {
  return (
    <div className={`flex flex-col bg-white ${standaloneTaskPage ? "" : "min-h-0 overflow-hidden"}`}>
      <div className="flex min-h-[72px] items-center justify-between gap-3 border-b border-slate-200 px-5 py-0">
        {showTaskSearch ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-md border border-cyan-200 bg-white">
              <Input
                value={taskSearchText}
                onChange={(event) => onTaskSearchTextChange(event.target.value)}
                placeholder={`Search ${selectedTask.title}`}
                className="h-10 border-0 bg-transparent text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <button
                type="button"
                className="flex h-10 w-12 items-center justify-center border-l border-slate-200 text-slate-700 transition hover:bg-slate-100"
                aria-label="Search task panel"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                className={`flex h-10 w-10 items-center justify-center rounded-md border transition ${
                  showTaskSearchFilter
                    ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
                aria-label="Filter task search"
                onClick={() => onSetShowTaskSearchFilter((value) => !value)}
              >
                <Funnel className="h-4 w-4" />
              </button>
              {showTaskSearchFilter ? (
                <div className="absolute left-0 top-12 z-20 w-56 rounded-md border border-slate-200 bg-white p-4 shadow-2xl">
                  <div className="space-y-4 text-slate-900">
                    {[
                      { value: "all", label: "All" },
                      { value: "conversations", label: "Conversations" },
                      { value: "tracked", label: "Tracked Changes" },
                    ].map((option) => {
                      const isActive = taskSearchFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          className="flex w-full items-center gap-3 text-left"
                          onClick={() => {
                            onTaskSearchFilterChange(option.value as "all" | "conversations" | "tracked");
                            onSetShowTaskSearchFilter(false);
                          }}
                        >
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              isActive ? "border-cyan-400" : "border-slate-400"
                            }`}
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-cyan-400" : "bg-transparent"}`} />
                          </span>
                          <span className="text-base font-medium text-slate-900">{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close task search"
              onClick={() => {
                onSetShowTaskSearch(false);
                onTaskSearchTextChange("");
                onSetShowTaskSearchFilter(false);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className={
                  standaloneTaskPage
                    ? "rounded-md bg-[#7c4a69] text-white hover:bg-[#6d3f5c]"
                    : activeSidePanel === "messages"
                      ? "rounded-md bg-slate-900 text-white hover:bg-slate-800"
                      : "rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300"
                }
                onClick={() => onActiveSidePanelChange("messages")}
              >
                Send message
              </Button>
              <Button
                type="button"
                className={activeSidePanel === "log" ? "rounded-md bg-[#44a2de] text-white hover:bg-[#3991ca]" : "rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300"}
                onClick={() => onActiveSidePanelChange("log")}
              >
                Log note
              </Button>
              <Button
                type="button"
                variant="secondary"
                className={
                  standaloneTaskPage
                    ? activeSidePanel === "activity"
                      ? "rounded-md bg-slate-300 text-slate-900 hover:bg-slate-300"
                      : "rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300"
                    : activeSidePanel === "activity"
                      ? "rounded-md bg-slate-900 text-white hover:bg-slate-800"
                      : "rounded-md bg-slate-200 text-slate-900 hover:bg-slate-300"
                }
                onClick={() => onActiveSidePanelChange("activity")}
              >
                Activity
              </Button>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <button
                type="button"
                className="rounded-md p-2 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Search task details"
                onClick={() => onSetShowTaskSearch(true)}
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md p-2 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Attach file"
                onClick={() => attachmentInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  onSelectedAttachmentNameChange(file?.name ?? "");
                }}
              />
              <div className="flex items-start gap-1 rounded-md p-2 text-emerald-400">
                <Users className="h-4 w-4" />
                <span className="text-xs font-semibold leading-none">1</span>
              </div>
            </div>
          </>
        )}
      </div>

      {!standaloneTaskPage || activeSidePanel === "messages" ? (
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <Popover
              open={taskAssigneePopoverTaskId === `${selectedTask.id}-detail-composer-assignee`}
              onOpenChange={(open) => onSetTaskAssigneePopoverTaskId(open ? `${selectedTask.id}-detail-composer-assignee` : null)}
            >
              <PopoverTrigger asChild>
                {taskAssignee ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 shrink-0 rounded-md bg-[#c89212] text-lg font-semibold text-white hover:bg-[#b8840f] hover:text-white"
                    aria-label={`View ${taskAssignee.name} details`}
                    title={taskAssignee.name}
                  >
                    {getEmployeeAvatarLetter(taskAssignee.name)}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 shrink-0 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Assign project team member to task"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                )}
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="bottom"
                sideOffset={8}
                avoidCollisions={false}
                className="w-[280px] max-w-[calc(100vw-2rem)] border-slate-200 bg-white p-2 text-slate-900 shadow-lg"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <TaskAssigneePopoverContent
                  task={selectedTask}
                  taskAssignee={taskAssignee}
                  employeeAssignments={employeeAssignments}
                  assigningTaskId={assigningTaskId}
                  onAssignEmployeeToTask={onAssignEmployeeToTask}
                  onOpenTaskEmployeeProfile={onOpenTaskEmployeeProfile}
                />
              </PopoverContent>
            </Popover>
            <div className="relative flex-1">
              <Input
                value={messageText}
                onChange={(event) => onMessageTextChange(event.target.value)}
                readOnly={activeSidePanel !== "messages"}
                disabled={activeSidePanel !== "messages" || isSendingMessage}
                placeholder={activeSidePanel === "messages" ? "Type a task message..." : "Activity view"}
                className="border-slate-200 bg-white pr-11 text-slate-900 placeholder:text-slate-400"
              />
              {activeSidePanel === "messages" ? (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-900"
                  onClick={() => onSetShowEmojiPicker((current) => !current)}
                  aria-label="Add reaction"
                >
                  <SmilePlus className="h-4 w-4" />
                </button>
              ) : null}
              {activeSidePanel === "messages" && showEmojiPicker ? (
                <div
                  ref={emojiPickerRef}
                  className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[320px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
                >
                  <div className="border-b border-slate-200 p-3">
                    <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 px-3">
                      <Input
                        value={emojiSearch}
                        onChange={(event) => onEmojiSearchChange(event.target.value)}
                        placeholder="grinning:"
                        className="h-10 border-0 bg-transparent px-0 text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <button type="button" className={`rounded-md px-2 py-1 ${emojiCategory === "smileys" ? "bg-slate-900 text-white" : "text-slate-500"}`} onClick={() => onEmojiCategoryChange("smileys")}>SMILEYS & EMOTION</button>
                      <button type="button" className={`rounded-md px-2 py-1 ${emojiCategory === "gestures" ? "bg-slate-900 text-white" : "text-slate-500"}`} onClick={() => onEmojiCategoryChange("gestures")}>GESTURES</button>
                      <button type="button" className={`rounded-md px-2 py-1 ${emojiCategory === "objects" ? "bg-slate-900 text-white" : "text-slate-500"}`} onClick={() => onEmojiCategoryChange("objects")}>OBJECTS</button>
                    </div>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto p-2.5">
                    <div className="grid grid-cols-6 gap-1.5">
                      {filteredEmojiResults.map((item) => (
                        <button
                          key={`${item.category}-${item.label}`}
                          type="button"
                          className="flex h-10 items-center justify-center rounded-md text-2xl transition hover:bg-slate-100"
                          title={item.label}
                          onClick={() => {
                            onMessageTextChange(`${messageText}${messageText ? " " : ""}${item.emoji}`);
                            onSetShowEmojiPicker(false);
                            onEmojiSearchChange("");
                          }}
                        >
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                    {filteredEmojiResults.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">No emojis found</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <div className="mt-4 flex justify-start">
            {activeSidePanel === "messages" ? (
              <Button type="button" className="rounded-md bg-blue-700 text-white hover:bg-blue-600" onClick={onSendTaskMessage} disabled={isSendingMessage}>
                {isSendingMessage ? "Sending..." : "Send"}
              </Button>
            ) : (
              <Button type="button" className="rounded-md bg-fuchsia-900/70 text-white hover:bg-fuchsia-800" onClick={() => onActiveSidePanelChange("log")}>
                Log
              </Button>
            )}
          </div>
          {activeSidePanel === "messages" && selectedAttachmentName ? (
            <p className="mt-3 text-xs text-slate-400">Selected file: {selectedAttachmentName}</p>
          ) : null}
        </div>
      ) : null}

      <div className={`px-5 py-5 ${standaloneTaskPage ? "" : "min-h-0 flex-1 overflow-y-auto"}`}>
        {activeSidePanel === "messages" ? messagesContent : activityContent}
      </div>
    </div>
  );
}
