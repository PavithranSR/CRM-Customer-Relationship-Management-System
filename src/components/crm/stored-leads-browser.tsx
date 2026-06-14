"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { permanentlyDeleteCrmLead, restoreArchivedCrmLead, restoreDeletedCrmLead } from "@/actions/crm.actions";
import { SearchFilterToolbar } from "@/components/shared/search-filter-toolbar";
import { StoredLeadActions } from "./stored-lead-actions";
import { StoredLeadConfirmDialog } from "./stored-lead-confirm-dialog";

type StoredLeadRow = {
  id: string;
  title: string | null;
  clientName: string | null;
  email: string | null;
  phone: string | null;
  updatedAt?: Date | string;
  deletedAt?: Date | string;
};

interface StoredLeadsBrowserProps {
  title: string;
  kind: "archive" | "deleted";
  backHref?: string;
  leads: StoredLeadRow[];
}

type FilterField = "name" | "email" | "phone" | "stage" | "date";
type ViewMode = "list" | "kanban";
type GroupByField = "none" | "name" | "email" | "phone" | "stage" | "date";

const FILTER_OPTIONS: Array<{ value: FilterField; label: string }> = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "stage", label: "Stage" },
  { value: "date", label: "Date" },
];

const GROUP_BY_OPTIONS: Array<{ value: GroupByField; label: string }> = [
  { value: "none", label: "None" },
  { value: "name", label: "Handled Person" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "stage", label: "Stage" },
  { value: "date", label: "Date" },
];

export function StoredLeadsBrowser({
  title,
  kind,
  backHref = "/crm",
  leads,
}: StoredLeadsBrowserProps) {
  const [query, setQuery] = useState("");
  const [filterFields, setFilterFields] = useState<FilterField[]>([]);
  const [groupBy, setGroupBy] = useState<GroupByField>("none");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [savedSearches, setSavedSearches] = useState<Array<{
    id: string;
    label: string;
    query: string;
    filterFields: FilterField[];
    groupBy: GroupByField;
  }>>([]);
  const [confirmState, setConfirmState] = useState<{ id: string; action: "restore" | "delete" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const stageLabel = kind === "archive" ? "Archived" : "Deleted";
  const dateLabel = kind === "archive" ? "Updated" : "Deleted";
  const activeFilterLabels = filterFields.map((field) =>
    field === "date"
      ? dateLabel
      : FILTER_OPTIONS.find((option) => option.value === field)?.label || field
  );
  const activeGroupByLabel =
    groupBy === "date"
      ? dateLabel
      : GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label || "None";

  const filteredLeads = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return leads;

    return leads.filter((lead) => {
      const leadName = (lead.clientName || lead.title || "").toLowerCase();
      const email = (lead.email || "").toLowerCase();
      const phone = (lead.phone || "").toLowerCase();
      const dateValue = new Date(kind === "archive" ? (lead.updatedAt || "") : (lead.deletedAt || "")).toLocaleDateString().toLowerCase();

      if (filterFields.length === 0) {
        return (
          leadName.includes(search) ||
          email.includes(search) ||
          phone.includes(search) ||
          stageLabel.toLowerCase().includes(search) ||
          dateValue.includes(search)
        );
      }

      return filterFields.some((field) => {
        switch (field) {
          case "name":
            return leadName.includes(search);
          case "email":
            return email.includes(search);
          case "phone":
            return phone.includes(search);
          case "stage":
            return stageLabel.toLowerCase().includes(search);
          case "date":
            return dateValue.includes(search);
        }
      });
    });
  }, [filterFields, kind, leads, query, stageLabel]);

  const groupedLeads = useMemo(() => {
    const getGroupValue = (lead: StoredLeadRow) => {
      switch (groupBy) {
        case "name":
          return lead.clientName || lead.title || "-";
        case "email":
          return lead.email || "-";
        case "phone":
          return lead.phone || "-";
        case "stage":
          return stageLabel;
        case "date":
          return new Date(kind === "archive" ? (lead.updatedAt || "") : (lead.deletedAt || "")).toLocaleDateString();
        default:
          return "All Leads";
      }
    };

    if (groupBy === "none") {
      return [{ label: "All Leads", leads: filteredLeads }];
    }

    const buckets = new Map<string, StoredLeadRow[]>();
    for (const lead of filteredLeads) {
      const label = getGroupValue(lead);
      const current = buckets.get(label) || [];
      current.push(lead);
      buckets.set(label, current);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, grouped]) => ({ label, leads: grouped }));
  }, [filteredLeads, groupBy, kind, stageLabel]);

  const saveCurrentSearch = () => {
    const nextLabel =
      query.trim() || `${activeFilterLabels.join(", ") || "All Fields"}${groupBy !== "none" ? ` / ${activeGroupByLabel}` : ""}`;
    setSavedSearches((current) => [
      {
        id: crypto.randomUUID(),
        label: nextLabel,
        query,
        filterFields,
        groupBy,
      },
      ...current,
    ]);
    toast.success("Search saved");
  };

  const clearAllSearchOptions = () => {
    setQuery("");
    setFilterFields([]);
    setGroupBy("none");
  };

  const toggleFilterField = (field: FilterField) => {
    setFilterFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field]
    );
  };

  const detailHref = (leadId: string) =>
    kind === "deleted"
      ? `/crm/deleted/${leadId}`
      : kind === "archive"
        ? `/crm/archive/${leadId}`
        : `/crm/${leadId}?from=${encodeURIComponent(backHref)}&label=${encodeURIComponent(title)}&scope=${encodeURIComponent(kind)}`;

  const activeChips = [
    ...activeFilterLabels.map((label, index) => ({
      id: `${filterFields[index]}-${index}`,
      label,
      kind: "filter" as const,
    })),
    ...(groupBy !== "none"
      ? [
          {
            id: groupBy,
            label: activeGroupByLabel,
            kind: "group" as const,
          },
        ]
      : []),
  ];

  const handleConfirmAction = () => {
    if (!confirmState) return;

    startTransition(async () => {
      if (confirmState.action === "restore") {
        const result =
          kind === "archive"
            ? await restoreArchivedCrmLead(confirmState.id)
            : await restoreDeletedCrmLead(confirmState.id);

        if ("error" in result && result.error) {
          toast.error(result.error);
          return;
        }

        toast.success(kind === "archive" ? "Lead restored from archive" : "Lead restored from deleted list");
        setConfirmState(null);
        router.refresh();
        return;
      }

      const result = await permanentlyDeleteCrmLead(confirmState.id);
      if ("error" in result && result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Could not delete lead");
        return;
      }

      toast.success("Lead deleted permanently");
      setConfirmState(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h1>
        <Link href={backHref} className="self-start text-sm font-medium text-slate-700 hover:underline sm:self-auto">
          Back to CRM
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <SearchFilterToolbar
          query={query}
          onQueryChange={setQuery}
          placeholder={`Search ${kind} leads...`}
          selectedFilters={filterFields}
          filterOptions={FILTER_OPTIONS.map((option) => ({
            value: option.value,
            label: option.value === "date" ? dateLabel : option.label,
          }))}
          onToggleFilter={(value) => toggleFilterField(value as FilterField)}
          activeChips={activeChips}
          onRemoveChip={(id, kindToRemove) => {
            if (kindToRemove === "group") {
              setGroupBy("none");
              return;
            }
            setFilterFields((current) => current.filter((field, index) => `${field}-${index}` !== id));
          }}
          groupByValue={groupBy}
          groupByOptions={GROUP_BY_OPTIONS.map((option) => ({
            value: option.value,
            label: option.value === "date" ? dateLabel : option.label,
          }))}
          onGroupByChange={(value) => setGroupBy(value as GroupByField)}
          onClearAll={clearAllSearchOptions}
          onSaveSearch={saveCurrentSearch}
          savedSearches={savedSearches}
          onApplySavedSearch={(id) => {
            const selected = savedSearches.find((item) => item.id === id);
            if (!selected) return;
            setQuery(selected.query);
            setFilterFields(selected.filterFields);
            setGroupBy(selected.groupBy);
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto overscroll-x-contain pb-1 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] touch-pan-x">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b bg-slate-100 text-left">
                  <th className="px-4 py-4 sm:px-5">Handled Person</th>
                  <th className="px-4 py-4 sm:px-5">Email</th>
                  <th className="px-4 py-4 sm:px-5">Phone</th>
                  <th className="px-4 py-4 sm:px-5">Stage</th>
                  <th className="px-4 py-4 sm:px-5">{dateLabel}</th>
                  <th className="sticky right-0 bg-slate-100 px-4 py-4 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.28)] sm:px-5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500">
                      No {kind} leads found
                    </td>
                  </tr>
                ) : (
                  groupedLeads.map((group) => (
                    group.leads.map((lead, index) => (
                      <Fragment key={lead.id}>
                        {groupBy !== "none" && index === 0 ? (
                          <tr key={`${group.label}-group`} className="border-b bg-slate-50">
                            <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-slate-700 sm:px-5">
                              {group.label}
                            </td>
                          </tr>
                        ) : null}
                        <tr
                          key={lead.id}
                          className="cursor-pointer border-b transition-colors hover:bg-slate-50 last:border-b-0"
                          onClick={() => router.push(detailHref(lead.id))}
                        >
                          <td className="px-4 py-4 sm:px-5">
                            <div className="font-medium text-slate-900">{lead.clientName || lead.title || "-"}</div>
                          </td>
                          <td className="px-4 py-4 sm:px-5">{lead.email || "-"}</td>
                          <td className="px-4 py-4 sm:px-5">{lead.phone || "-"}</td>
                          <td className="px-4 py-4 sm:px-5">{stageLabel}</td>
                          <td className="px-4 py-4 sm:px-5">
                            {new Date(kind === "archive" ? (lead.updatedAt || "") : (lead.deletedAt || "")).toLocaleDateString()}
                          </td>
                          <td className="sticky right-0 bg-white px-4 py-4 text-right shadow-[-10px_0_12px_-12px_rgba(15,23,42,0.2)] sm:px-5">
                            <StoredLeadActions
                              kind={kind}
                              onRestore={() => setConfirmState({ id: lead.id, action: "restore" })}
                              onDelete={kind === "deleted" ? () => setConfirmState({ id: lead.id, action: "delete" }) : undefined}
                            />
                          </td>
                        </tr>
                      </Fragment>
                    ))
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLeads.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No {kind} leads found
            </div>
          ) : (
            groupedLeads.map((group) => (
              <div key={group.label} className="space-y-3">
                {groupBy !== "none" ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                    {group.label}
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {group.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                      onClick={() => router.push(detailHref(lead.id))}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-slate-900">{lead.clientName || lead.title || "-"}</p>
                          <p className="mt-1 text-sm text-slate-500">{lead.email || "-"}</p>
                        </div>
                      <StoredLeadActions
                        kind={kind}
                        onRestore={() => setConfirmState({ id: lead.id, action: "restore" })}
                        onDelete={kind === "deleted" ? () => setConfirmState({ id: lead.id, action: "delete" }) : undefined}
                      />
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-slate-700">
                        <p>
                          <span className="text-slate-500">Phone:</span> {lead.phone || "-"}
                        </p>
                        <p>
                          <span className="text-slate-500">Stage:</span> {stageLabel}
                        </p>
                        <p>
                          <span className="text-slate-500">{dateLabel}:</span>{" "}
                          {new Date(kind === "archive" ? (lead.updatedAt || "") : (lead.deletedAt || "")).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <StoredLeadConfirmDialog
        confirmState={confirmState}
        kind={kind}
        onConfirm={handleConfirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmState(null);
          }
        }}
        pending={isPending}
      />
    </div>
  );
}
