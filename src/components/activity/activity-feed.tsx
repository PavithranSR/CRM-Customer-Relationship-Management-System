"use client";

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { ActivityAction } from "@prisma/client";
import {
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  LogIn,
  LogOut,
  Plus,
} from "lucide-react";

interface ActivityLog {
  id: string;
  action: ActivityAction;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  user: { id: string; name: string; email: string } | null;
  createdBy: { id: string; name: string; email: string };
}

interface ActivityFeedProps {
  logs: ActivityLog[];
}

const actionIcons: Record<ActivityAction, React.ReactNode> = {
  CREATE: <Plus className="h-4 w-4" />,
  UPDATE: <Edit className="h-4 w-4" />,
  DELETE: <Trash2 className="h-4 w-4" />,
  ASSIGN: <UserPlus className="h-4 w-4" />,
  UNASSIGN: <UserMinus className="h-4 w-4" />,
  STATUS_CHANGE: <RefreshCw className="h-4 w-4" />,
  HOLD: <Pause className="h-4 w-4" />,
  RESTART: <Play className="h-4 w-4" />,
  LOGIN: <LogIn className="h-4 w-4" />,
  LOGOUT: <LogOut className="h-4 w-4" />,
};

const actionColors: Record<ActivityAction, string> = {
  CREATE: "bg-green-500",
  UPDATE: "bg-blue-500",
  DELETE: "bg-red-500",
  ASSIGN: "bg-purple-500",
  UNASSIGN: "bg-orange-500",
  STATUS_CHANGE: "bg-yellow-500",
  HOLD: "bg-yellow-600",
  RESTART: "bg-green-600",
  LOGIN: "bg-gray-500",
  LOGOUT: "bg-gray-400",
};

function getActionDescription(log: ActivityLog): string {
  const metadata = (log.metadata && typeof log.metadata === "object" ? log.metadata : null) as Record<string, unknown> | null;

  switch (log.action) {
    case "CREATE":
      if (log.entityType === "user") {
        return `created employee ${metadata?.name || ""}`;
      }
      if (log.entityType === "project") {
        return `created project ${metadata?.name || ""}`;
      }
      if (log.entityType === "time_entry") {
        return `logged ${metadata?.hours || 0} hours`;
      }
      return `created ${log.entityType}`;

    case "UPDATE":
      if (log.entityType === "user") {
        return `updated employee profile`;
      }
      if (log.entityType === "project") {
        if (metadata?.progress !== undefined) {
          return `updated project progress to ${metadata.progress}%`;
        }
        return `updated project details`;
      }
      return `updated ${log.entityType}`;

    case "DELETE":
      if (log.entityType === "user") {
        return `deleted employee ${metadata?.name || ""}`;
      }
      if (log.entityType === "project") {
        return `deleted project ${metadata?.name || ""}`;
      }
      return `deleted ${log.entityType}`;

    case "ASSIGN":
      return `assigned ${metadata?.employeeName || "team member"} to project`;

    case "UNASSIGN":
      return `removed ${metadata?.employeeName || "team member"} from project`;

    case "STATUS_CHANGE":
      return `changed status from ${metadata?.oldStatus} to ${metadata?.newStatus}`;

    case "HOLD":
      return `put project on hold: ${metadata?.reason || ""}`;

    case "RESTART":
      return `restarted project after ${metadata?.holdDays || 0} days`;

    case "LOGIN":
      return "logged in";

    case "LOGOUT":
      return "logged out";

    default:
      return String(log.action).toLowerCase();
  }
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activity logs found
      </div>
    );
  }

  // Group logs by date
  const groupedLogs: Record<string, ActivityLog[]> = {};
  logs.forEach((log) => {
    const dateKey = format(new Date(log.createdAt), "yyyy-MM-dd");
    if (!groupedLogs[dateKey]) {
      groupedLogs[dateKey] = [];
    }
    groupedLogs[dateKey].push(log);
  });

  const sortedDates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {format(new Date(dateKey), "EEEE, MMMM d, yyyy")}
          </h3>
          <div className="space-y-3">
            {groupedLogs[dateKey].map((log) => (
              <div key={log.id} className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${actionColors[log.action]} flex items-center justify-center text-white`}>
                  {actionIcons[log.action]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{log.createdBy.name}</span>
                    <span className="text-muted-foreground">{getActionDescription(log)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{log.entityType}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(log.createdAt), "h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
