"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Search, User } from "lucide-react";
import { toast } from "sonner";
import { addCrmInvoiceChatterEntry } from "@/actions/quotation.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatterMode = "message" | "note" | "activity";

interface CrmInvoiceChatterLogItem {
  id: string;
  action: string;
  createdAt: string;
  createdByName: string | null;
  metadata: Record<string, unknown> | null;
}

interface CrmInvoiceChatterProps {
  quotationId: string;
  currentUserName: string;
  initialLogs: CrmInvoiceChatterLogItem[];
}

function formatStageLabel(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLogSummary(log: CrmInvoiceChatterLogItem) {
  const metadata = log.metadata ?? {};
  const chatterType = typeof metadata.chatterType === "string" ? metadata.chatterType : null;
  const body = typeof metadata.body === "string" ? metadata.body : "";
  const paymentType = typeof metadata.paymentType === "string" ? metadata.paymentType : null;
  const paidAmount = typeof metadata.paidAmount === "number" ? metadata.paidAmount : null;
  const amount = typeof metadata.amount === "number" ? metadata.amount : null;

  if (chatterType === "message") {
    return { title: "Message sent", body };
  }

  if (chatterType === "note") {
    return { title: "Internal note", body };
  }

  if (log.action === "STATUS_CHANGE") {
    const stage = typeof metadata.stage === "string" ? metadata.stage : "";
    return {
      title: "Stage changed",
      body: stage ? `Moved to ${formatStageLabel(stage)}` : "Stage updated",
    };
  }

  if (log.action === "CREATE") {
    if (paymentType || paidAmount !== null || amount !== null) {
      return {
        title: "Payment recorded",
        body:
          paidAmount !== null
            ? `Recorded ${new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2,
              }).format(paidAmount)}`
            : "Payment details captured",
      };
    }

    return {
      title: "Invoice created",
      body: "",
    };
  }

  if (log.action === "DELETE" && paymentType) {
    return {
      title: "Payment deleted",
      body:
        paidAmount !== null
          ? `Removed ${new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 2,
            }).format(paidAmount)}`
          : "Payment record removed",
    };
  }

  if (Array.isArray(metadata.changes) && metadata.changes.length > 0) {
    return {
      title: "Invoice updated",
      body: `Updated ${metadata.changes.length} field${metadata.changes.length === 1 ? "" : "s"}`,
    };
  }

  if (log.action === "UPDATE" && metadata.paymentEdited) {
    return {
      title: "Payment updated",
      body:
        paidAmount !== null
          ? `Updated to ${new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 2,
            }).format(paidAmount)}`
          : "Payment record updated",
    };
  }

  if (log.action === "UPDATE" && (paymentType || paidAmount !== null || amount !== null)) {
    return {
      title: "Payment recorded",
      body:
        paidAmount !== null
          ? `Current paid amount ${new Intl.NumberFormat("en-IN", {
              style: "currency",
              currency: "INR",
              minimumFractionDigits: 2,
            }).format(paidAmount)}`
          : "Invoice payment summary updated",
    };
  }

  return {
    title: log.action.replace(/_/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase()),
    body,
  };
}

export function CrmInvoiceChatter({
  quotationId,
  currentUserName,
  initialLogs,
}: CrmInvoiceChatterProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ChatterMode>("note");
  const [draft, setDraft] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  const placeholder =
    mode === "message" ? "Write a message for this invoice..." : "Log an internal note...";
  const submitLabel = mode === "message" ? "Send" : "Log";
  const hasDraft = draft.trim().length > 0;
  const filteredLogs = initialLogs.filter((log) => {
    if (!searchTerm.trim()) return true;
    const summary = getLogSummary(log);
    const haystack = [log.createdByName || "", summary.title, summary.body, log.createdAt]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchTerm.trim().toLowerCase());
  });
  const participantCount = new Set(
    initialLogs
      .map((log) => log.createdByName?.trim())
      .filter((value): value is string => Boolean(value)),
  ).size || 1;

  const handleSubmit = () => {
    if (mode === "activity" || !hasDraft) return;
    const nextDraft = draft.trim();

    startTransition(async () => {
      const result = await addCrmInvoiceChatterEntry(quotationId, mode, nextDraft);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(mode === "message" ? "Message added" : "Note added");
      setDraft("");
      router.refresh();
    });
  };

  return (
    <div className="min-w-0">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <Button
                size="sm"
                type="button"
                onClick={() => setMode("message")}
                className={
                  mode === "message"
                    ? "h-8 rounded-sm bg-[#7c4a69] px-2.5 text-sm shadow-none hover:bg-[#6d425d]"
                    : "h-8 rounded-sm px-2.5 text-sm shadow-none"
                }
                variant={mode === "message" ? "default" : "secondary"}
              >
                Send message
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => setMode("note")}
                className={
                  mode === "note"
                    ? "h-8 rounded-sm border-[#7c4a69] px-2.5 text-sm text-[#7c4a69] shadow-none hover:bg-[#f8f3f6]"
                    : "h-8 rounded-sm px-2.5 text-sm shadow-none"
                }
                variant={mode === "note" ? "outline" : "secondary"}
              >
                Log note
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => setMode("activity")}
                className="h-8 rounded-sm px-2.5 text-sm shadow-none"
                variant={mode === "activity" ? "default" : "secondary"}
              >
                Activity
              </Button>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1.5 text-slate-600">
              <button
                type="button"
                className="hover:text-slate-900"
                aria-label="Search activity"
                onClick={() => {
                  setSearchOpen((current) => !current);
                  if (searchOpen) {
                    setSearchTerm("");
                  }
                }}
              >
                <Search className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="hover:text-slate-900"
                aria-label="Choose draft attachment"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1 text-xs font-medium text-slate-700">
                <User className="h-3.5 w-3.5" />
                <span>{participantCount}</span>
              </div>
            </div>
          </div>

          {searchOpen ? (
            <div className="mt-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search chatter..."
                className="h-8 w-full rounded-sm border px-3 text-sm outline-none focus:border-cyan-600"
              />
            </div>
          ) : null}
        </div>

        <div className="px-3 py-3">
          {mode !== "activity" ? (
            <>
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#4a468c] text-sm font-semibold text-white">
                  {currentUserName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={placeholder}
                    rows={3}
                    className="min-h-[92px] w-full resize-y rounded-md border bg-white"
                  />
                </div>
              </div>

              <div className="mt-3.5 flex items-center gap-3">
                <Button
                  size="sm"
                  type="button"
                  onClick={handleSubmit}
                  disabled={isPending || !hasDraft}
                  className={
                    hasDraft
                      ? "h-8 rounded-sm bg-[#7c4a69] px-3.5 text-white shadow-none hover:bg-[#6d425d]"
                      : "h-8 rounded-sm bg-[#c4afbf] px-3.5 text-white shadow-none hover:bg-[#c4afbf]"
                  }
                >
                  {isPending ? `${submitLabel}...` : submitLabel}
                </Button>
              </div>
            </>
          ) : null}

          <div className={`${mode === "activity" ? "mt-0" : "mt-4.5"} flex items-center gap-4`}>
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-sm text-slate-400">Recent activity</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-4 space-y-4.5">
            {filteredLogs.length === 0 ? (
              <p className="text-sm text-slate-500">
                {searchTerm.trim() ? "No activity matched your search." : "No activity yet."}
              </p>
            ) : (
              filteredLogs.map((log) => {
                const summary = getLogSummary(log);

                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#4a468c] text-sm font-semibold text-white">
                      {(log.createdByName || currentUserName).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{log.createdByName || "User"}</p>
                        <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="mt-1 text-sm text-slate-800">{summary.title}</p>
                      {summary.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{summary.body}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={() => toast.info("File attachment storage is not connected yet.")}
      />
    </div>
  );
}
