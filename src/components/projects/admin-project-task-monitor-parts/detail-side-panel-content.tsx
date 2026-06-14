"use client";

import { format } from "date-fns";
import type { CommentNode } from "@/actions/project-comment.actions";
import { type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";

export interface TaskActivityLogItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: Date;
  metadata: unknown;
  createdBy: { id: string; name: string | null; email: string | null };
}

export function flattenComments(comments: CommentNode[]): CommentNode[] {
  return comments.flatMap((comment) => [comment, ...flattenComments(comment.replies)]);
}

export function getTaskActivityMessage(
  log: Pick<TaskActivityLogItem, "action" | "entityType" | "metadata">,
  peopleMap: Map<string, TeamPerson>
) {
  const metadata = log.metadata && typeof log.metadata === "object" ? (log.metadata as Record<string, unknown>) : {};
  const getPriorityLabelFromLevel = (value: unknown) => {
    if (value === 3 || value === "3") return "Urgent";
    if (value === 2 || value === "2") return "High priority";
    if (value === 1 || value === "1") return "Low priority";
    return "None";
  };
  const getFormattedDateTime = (value: unknown) => {
    if (typeof value !== "string" || !value) return "None";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "None";
    return format(date, "dd/MM/yyyy hh:mm:ss a");
  };

  if (log.entityType === "task_comment") {
    return { title: "Comment added", from: null, to: String(metadata.text ?? "No comment"), field: "Comment" };
  }
  const actionType = typeof metadata.actionType === "string" ? metadata.actionType : "";
  if (actionType === "REASSIGN") {
    const previousAssigneeId =
      typeof metadata.previousEmployeeAssigneeId === "string" && metadata.previousEmployeeAssigneeId.length > 0
        ? metadata.previousEmployeeAssigneeId
        : typeof metadata.taskOwnerId === "string"
          ? metadata.taskOwnerId
          : "";
    const nextAssigneeId = typeof metadata.newEmployeeAssigneeId === "string" ? metadata.newEmployeeAssigneeId : "";
    return {
      title: "",
      from: peopleMap.get(previousAssigneeId)?.name ?? "None",
      to: peopleMap.get(nextAssigneeId)?.name ?? "None",
      field: "Assignees",
    };
  }
  if (actionType === "CHANGE_PRIORITY") {
    return {
      title: "",
      from: getPriorityLabelFromLevel(metadata.previousPriority),
      to: getPriorityLabelFromLevel(metadata.newPriority),
      field: "Priority",
    };
  }
  if (actionType === "CHANGE_DEADLINE") {
    return {
      title: "",
      from: getFormattedDateTime(metadata.previousDueDate),
      to: getFormattedDateTime(metadata.newDueDate),
      field: "Deadline",
    };
  }
  if (actionType === "ADD_SUBTASK") {
    return { title: "Sub-task added", from: null, to: String(metadata.subtaskTitle ?? "New sub-task"), field: "Sub-task" };
  }
  if (actionType === "EDIT") {
    return { title: "Task updated", from: null, to: "Task details were edited", field: "Task" };
  }
  if (typeof metadata.comment === "string" && metadata.comment.trim().length > 0) {
    return { title: "Daily update", from: null, to: metadata.comment, field: "Update" };
  }
  if (log.action === "DELETE") {
    return { title: "Task deleted", from: null, to: String(metadata.title ?? "Task removed"), field: "Task" };
  }
  return { title: "Task activity", from: null, to: "Task action recorded", field: "Task" };
}

function renderCommentThread(comments: CommentNode[], depth = 0): React.ReactNode {
  return comments.map((comment) => (
    <div key={comment.id} className="space-y-2" style={{ marginLeft: depth > 0 ? depth * 14 : 0 }}>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-500 text-base font-semibold text-white">
          {(comment.author.name || comment.author.email || "U").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-200">{comment.author.name || comment.author.email}</span>
            <span className="text-slate-500">{format(new Date(comment.createdAt), "h:mm a")}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.text}</p>
        </div>
      </div>
      {comment.replies.length > 0 ? (
        <div className="space-y-4 border-l border-slate-700 pl-4">{renderCommentThread(comment.replies, depth + 1)}</div>
      ) : null}
    </div>
  ));
}

function renderCommentSearchResults(comments: CommentNode[]) {
  return comments.map((comment) => (
    <div key={comment.id} className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-500 text-base font-semibold text-white">
        {(comment.author.name || comment.author.email || "U").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-200">{comment.author.name || comment.author.email}</span>
          <span className="text-slate-500">{format(new Date(comment.createdAt), "h:mm a")}</span>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{comment.text}</p>
      </div>
    </div>
  ));
}

interface DetailMessagesContentProps {
  filteredTaskComments: CommentNode[];
  normalizedTaskSearch: string;
  taskComments: CommentNode[];
  taskSearchFilter: "all" | "conversations" | "tracked";
}

export function DetailMessagesContent({
  filteredTaskComments,
  normalizedTaskSearch,
  taskComments,
  taskSearchFilter,
}: DetailMessagesContentProps) {
  return (
    <div className="space-y-4">
      <p className="mb-2 text-center text-sm text-slate-500">Messages</p>
      {taskSearchFilter === "tracked" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          No conversation messages match the selected filter.
        </div>
      ) : filteredTaskComments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {normalizedTaskSearch ? "No messages match your search." : "No messages yet."}
        </div>
      ) : normalizedTaskSearch ? (
        renderCommentSearchResults(filteredTaskComments)
      ) : (
        renderCommentThread(taskComments)
      )}
    </div>
  );
}

interface DetailActivityContentProps {
  activeSidePanel: "messages" | "log" | "activity";
  filteredTaskActivityLogs: TaskActivityLogItem[];
  normalizedTaskSearch: string;
  peopleMap: Map<string, TeamPerson>;
}

export function DetailActivityContent({
  activeSidePanel,
  filteredTaskActivityLogs,
  normalizedTaskSearch,
  peopleMap,
}: DetailActivityContentProps) {
  return (
    <>
      <p className="mb-4 text-center text-sm text-slate-500">{activeSidePanel === "activity" ? "Activity" : "Today"}</p>
      <div className="space-y-4">
        {filteredTaskActivityLogs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {normalizedTaskSearch ? "No activity matches your search." : "No activity yet."}
          </div>
        ) : (
          filteredTaskActivityLogs.map((log) => {
            const message = getTaskActivityMessage(log, peopleMap);
            return (
              <div key={log.id} className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-slate-500 text-lg font-semibold text-white">
                  {(log.createdBy.name || log.createdBy.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-slate-900">
                      {log.createdBy.name || log.createdBy.email || "Unknown user"}
                    </span>
                    <span className="text-slate-500">{format(new Date(log.createdAt), "h:mm a")}</span>
                  </div>
                  {message.title ? <p className="text-base text-slate-900">{message.title}</p> : null}
                  {message.from !== null ? (
                    <p className="text-base text-slate-700">
                      <span className="font-medium text-slate-500">{message.from}</span>
                      <span className="mx-2 text-slate-500">?</span>
                      <span className="font-semibold text-blue-400">{message.to}</span>
                      <span className="ml-2 italic text-slate-500">({message.field})</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">{message.to}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
