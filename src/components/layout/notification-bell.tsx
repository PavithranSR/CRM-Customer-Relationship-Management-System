"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { getMyNotifications, type AppNotification } from "@/actions/notification.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NotificationBellProps {
  userKey: string;
}

const NOTIFICATION_REFRESH_INTERVAL_MS = 15000;

export function NotificationBell({ userKey }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(`notification-last-seen:${userKey}`);
    } catch {
      return null;
    }
  });

  const storageKey = `notification-last-seen:${userKey}`;

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const data = await getMyNotifications(20).catch(() => [] as AppNotification[]);
      if (!mounted) return;
      setNotifications(data);
    };

    load();
    const interval = window.setInterval(load, NOTIFICATION_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);

  const unreadCount = useMemo(() => {
    if (!lastSeenAt) return notifications.length;
    const seenTime = new Date(lastSeenAt).getTime();
    return notifications.filter(
      (item) => new Date(item.createdAt).getTime() > seenTime
    ).length;
  }, [notifications, lastSeenAt]);

  const handleOpenChange = (open: boolean) => {
    setIsMenuOpen(open);
    if (!open) return;
    const now = new Date().toISOString();
    setLastSeenAt(now);
    try {
      window.localStorage.setItem(storageKey, now);
    } catch {
      // ignore storage errors
    }
  };

  const handleNotificationSelect = (item: AppNotification) => {
    setSelectedNotification(item);
    setIsMenuOpen(false);
  };

  const selectedDetail = selectedNotification?.detail;

  return (
    <>
      <DropdownMenu open={isMenuOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">No notifications.</div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto px-2 py-1">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationSelect(item)}
                  className="w-full rounded-[var(--radius)] border border-border p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {formatDistanceToNow(new Date(item.createdAt), {
                        addSuffix: true,
                      })}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.message}</p>
                </button>
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={Boolean(selectedNotification)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotification(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedNotification?.title ?? "Notification"}</DialogTitle>
            <DialogDescription>{selectedNotification?.message}</DialogDescription>
          </DialogHeader>

          {selectedDetail?.kind === "employee_scheduled_activity" ? (
            <div className="space-y-4 text-sm text-foreground/80">
              <div className="grid gap-3 rounded-[var(--radius)] border border-border bg-background p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Activity</p>
                  <p className="mt-1 font-medium text-foreground">{selectedDetail.activityLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Due Date</p>
                  <p className="mt-1 font-medium text-foreground">{selectedDetail.dueDate || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Flow</p>
                  <p className="mt-1 font-medium capitalize text-foreground">
                    {selectedDetail.flow || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Time</p>
                  <p className="mt-1 font-medium text-foreground">
                    {selectedDetail.meetingTime
                      ? selectedDetail.meetingEndTime
                        ? `${selectedDetail.meetingTime} - ${selectedDetail.meetingEndTime}`
                        : selectedDetail.meetingTime
                      : "-"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Summary</p>
                <p className="mt-1 rounded-[var(--radius)] border border-border bg-card p-3 font-medium text-foreground">
                  {selectedDetail.summary}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Note</p>
                <p className="mt-1 min-h-20 whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-card p-3 text-foreground">
                  {selectedDetail.note || "No note added."}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/80">{selectedNotification?.message}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
