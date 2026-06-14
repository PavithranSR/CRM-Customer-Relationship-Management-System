"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Mail, MessageSquare, Paperclip, Search, User } from "lucide-react";
import { toast } from "sonner";
import { addClientNote } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  createdAt: Date;
  metadata: unknown;
  createdBy: {
    name: string | null;
  } | null;
}

interface ClientActivityPanelProps {
  clientId: string;
  clientName: string;
  clientEmail: string;
  logs: ActivityItem[];
}

function getMetadataText(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const data = metadata as Record<string, unknown>;
  if (typeof data.note === "string") return data.note;
  if (typeof data.name === "string") return `Name: ${data.name}`;
  if (typeof data.email === "string") return `Email: ${data.email}`;
  if (Array.isArray(data.changes)) return `Changes: ${data.changes.join(", ")}`;
  return "";
}

export function ClientActivityPanel({
  clientId,
  clientName,
  clientEmail,
  logs,
}: ClientActivityPanelProps) {
  const router = useRouter();
  const [activeAction, setActiveAction] = useState<"message" | "note" | "activity">("message");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const metadataText = getMetadataText(log.metadata).toLowerCase();
      return (
        log.action.toLowerCase().includes(term) ||
        (log.createdBy?.name || "").toLowerCase().includes(term) ||
        metadataText.includes(term)
      );
    });
  }, [logs, search]);

  const handleSendMessage = () => {
    if (!clientEmail) {
      toast.error("Email is optional for this contact");
      return;
    }
    setActiveAction("message");
    setShowNoteBox(false);
    window.location.href = `mailto:${clientEmail}?subject=Regarding ${encodeURIComponent(clientName)}`;
  };

  const handleCopyEmail = async () => {
    if (!clientEmail) {
      toast.error("Email is optional for this contact");
      return;
    }
    try {
      await navigator.clipboard.writeText(clientEmail);
      toast.success("Email copied");
    } catch {
      toast.error("Could not copy email");
    }
  };

  const handleNoteSubmit = () => {
    startTransition(async () => {
      const result = await addClientNote(clientId, note);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Note added");
      setNote("");
      setShowNoteBox(false);
      setActiveAction("message");
      router.refresh();
    });
  };

  const actionButtonClass = (isActive: boolean) =>
    `shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:px-4 ${
      isActive
        ? "bg-[#7c4a69] text-white"
        : "bg-slate-100 text-slate-900 hover:bg-slate-200"
    }`;

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/30 p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button
            type="button"
            className={actionButtonClass(activeAction === "message")}
            aria-pressed={activeAction === "message"}
            onClick={handleSendMessage}
          >
            Send message
          </button>
          <button
            type="button"
            className={actionButtonClass(activeAction === "note")}
            aria-pressed={activeAction === "note"}
            onClick={() => {
              setActiveAction("note");
              setShowNoteBox((v) => !v);
            }}
          >
            Log note
          </button>
          <button
            type="button"
            className={`basis-full shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium sm:basis-auto sm:px-4 ${
              activeAction === "activity"
                ? "bg-[#7c4a69] text-white"
                : "bg-slate-100 text-slate-900 hover:bg-slate-200"
            }`}
            aria-pressed={activeAction === "activity"}
            onClick={() => {
              setActiveAction("activity");
              setShowNoteBox(false);
              document.getElementById("client-activity-list")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Activity
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-slate-600 sm:gap-3">
          <button type="button" className="shrink-0" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="h-5 w-5" />
          </button>
          <button type="button" className="shrink-0" onClick={handleCopyEmail}>
            <Paperclip className="h-5 w-5" />
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <User className="h-5 w-5" />
            <span>{logs.length}</span>
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="mb-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search activity..."
          />
        </div>
      )}

      {showNoteBox && (
        <div className="mb-4 space-y-2 rounded-lg border border-sky-100 bg-white p-3">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Type your note..."
            disabled={isPending}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={handleNoteSubmit} disabled={isPending}>
              Save note
            </Button>
          </div>
        </div>
      )}

      <div className="border-t border-sky-100 pt-4" id="client-activity-list">
        <p className="mb-3 text-right text-sm text-slate-500">Today</p>
        <div className="space-y-4">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity found.</p>
          ) : (
            filteredLogs.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-sky-100 bg-white p-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#7c4a69]" />
                  <p className="font-medium">
                    {activity.createdBy?.name || "Administrator"}{" "}
                    <span className="text-sm text-slate-500">
                      {format(new Date(activity.createdAt), "h:mm a")}
                    </span>
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {activity.action} - {getMetadataText(activity.metadata) || clientName}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <Mail className="h-3 w-3" />
        <span>{clientEmail || "Optional"}</span>
      </div>
    </div>
  );
}
