"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Clock3, MoreHorizontal, Pencil, SlidersHorizontal, Trash2 } from "lucide-react";
import type { CrmLeadItem } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CrmPipelineProps } from "./crm-pipeline-types";
import { normalizePhone, normalizeText } from "./crm-pipeline-utils";

type CrmLeadListColumnId =
  | "created_on"
  | "contact"
  | "contact_name"
  | "phone"
  | "city"
  | "state"
  | "country"
  | "salesperson"
  | "sales_team"
  | "priority"
  | "activities"
  | "activity_by"
  | "my_deadline"
  | "campaign"
  | "medium"
  | "source"
  | "expected_revenue"
  | "stage";

type CrmClientLookupItem = CrmPipelineProps["clients"][number];

interface ListColumnConfig {
  id: CrmLeadListColumnId;
  menuLabel: string;
  headerLabel: string;
  render: (lead: CrmLeadItem) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

const LIST_COLUMN_ORDER: CrmLeadListColumnId[] = [
  "contact_name",
  "contact",
  "phone",
  "salesperson",
  "activities",
  "stage",
  "created_on",
  "city",
  "state",
  "country",
  "sales_team",
  "priority",
  "activity_by",
  "my_deadline",
  "campaign",
  "medium",
  "source",
  "expected_revenue",
];

const DEFAULT_VISIBLE_COLUMN_IDS: CrmLeadListColumnId[] = [
  "contact_name",
  "contact",
  "phone",
  "salesperson",
  "activities",
  "stage",
];

const LIST_FIELDS_STORAGE_KEY = "crm-pipeline-list-visible-columns";

const TAG_VALUE_ALIASES: Record<"city" | "state" | "country" | "campaign" | "medium" | "source", string[]> = {
  city: ["city", "clientCity", "addressCity", "town", "locationCity"],
  state: ["state", "province", "region", "clientState", "addressState"],
  country: ["country", "clientCountry", "addressCountry", "nation"],
  campaign: ["campaign"],
  medium: ["medium"],
  source: ["source", "lead-source", "leadSourceType"],
};

function readLeadTagValue(tags: string | null, key: keyof typeof TAG_VALUE_ALIASES) {
  if (!tags) return "";

  const marker = "__client_meta__:";
  const markerIndex = tags.indexOf(marker);
  const candidates = TAG_VALUE_ALIASES[key];

  if (markerIndex >= 0) {
    let metaRaw = tags.slice(markerIndex + marker.length).trim();
    if (metaRaw.startsWith("\"") && metaRaw.endsWith("\"")) {
      metaRaw = metaRaw.slice(1, -1);
    }
    metaRaw = metaRaw.replace(/\\"/g, "\"");

    try {
      const parsed = JSON.parse(metaRaw) as Record<string, unknown>;
      for (const candidate of candidates) {
        const directValue = parsed[candidate];
        if (typeof directValue === "string" && directValue.trim()) {
          return directValue.trim();
        }
      }

      for (const [metaKey, metaValue] of Object.entries(parsed)) {
        if (
          candidates.some((candidate) => candidate.toLowerCase() === metaKey.toLowerCase()) &&
          typeof metaValue === "string" &&
          metaValue.trim()
        ) {
          return metaValue.trim();
        }
      }
    } catch {
      // Keep the tag fallback below for legacy text formats.
    }
  }

  const parts = tags
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const found = parts.find((item) => {
    const lower = item.toLowerCase();
    return candidates.some((candidate) => lower.startsWith(`${candidate.toLowerCase()}:`));
  });

  return found ? found.split(":").slice(1).join(":").trim() : "";
}

function formatDateValue(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatPriorityLabel(level: number | null | undefined) {
  if (level === 3) return "High";
  if (level === 2) return "Medium";
  if (level === 1) return "Low";
  return "-";
}

function formatSalesTeamLabel(value: string | null | undefined) {
  return value
    ? value
        .toLowerCase()
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "-";
}

function normalizeVisibleColumnIds(ids: string[]) {
  const next = LIST_COLUMN_ORDER.filter((id) => ids.includes(id));
  return next.length > 0 ? next : DEFAULT_VISIBLE_COLUMN_IDS;
}

export interface CrmPipelineListViewProps {
  clients: CrmPipelineProps["clients"];
  allLeadsSelected: boolean;
  filteredLeads: CrmLeadItem[];
  orderedLeads: CrmLeadItem[];
  visibleSelectedLeadIds: string[];
  stageLabels: Record<string, string>;
  currency: Intl.NumberFormat;
  onToggleAllLeadsSelection: (checked: boolean) => void;
  onToggleLeadSelection: (leadId: string, checked: boolean) => void;
  onOpenLeadDetails: (leadId: string) => void;
  onEditLead: (lead: CrmLeadItem) => void;
  onRequestDelete: (ids: string[]) => void;
}

export function CrmPipelineListView({
  clients,
  allLeadsSelected,
  filteredLeads,
  orderedLeads,
  visibleSelectedLeadIds,
  stageLabels,
  currency,
  onToggleAllLeadsSelection,
  onToggleLeadSelection,
  onOpenLeadDetails,
  onEditLead,
  onRequestDelete,
}: CrmPipelineListViewProps) {
  const [visibleColumnIds, setVisibleColumnIds] = useState<CrmLeadListColumnId[]>(DEFAULT_VISIBLE_COLUMN_IDS);
  const [hasLoadedStoredColumns, setHasLoadedStoredColumns] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedValue = window.localStorage.getItem(LIST_FIELDS_STORAGE_KEY);
      if (!storedValue) {
        setHasLoadedStoredColumns(true);
        return;
      }

      const parsed = JSON.parse(storedValue);
      if (!Array.isArray(parsed)) {
        setHasLoadedStoredColumns(true);
        return;
      }

      setVisibleColumnIds(normalizeVisibleColumnIds(parsed.filter((item): item is string => typeof item === "string")));
    } catch {
      // Ignore invalid local storage and keep defaults.
    } finally {
      setHasLoadedStoredColumns(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredColumns || typeof window === "undefined") return;
    window.localStorage.setItem(LIST_FIELDS_STORAGE_KEY, JSON.stringify(visibleColumnIds));
  }, [hasLoadedStoredColumns, visibleColumnIds]);

  const clientsByEmail = useMemo(() => {
    const map = new Map<string, CrmClientLookupItem>();
    clients.forEach((client) => {
      const key = normalizeText(client.email);
      if (key) {
        map.set(key, client);
      }
    });
    return map;
  }, [clients]);

  const clientsByPhone = useMemo(() => {
    const map = new Map<string, CrmClientLookupItem>();
    clients.forEach((client) => {
      const key = normalizePhone(client.phone);
      if (key) {
        map.set(key, client);
      }
    });
    return map;
  }, [clients]);

  const clientsByName = useMemo(() => {
    const map = new Map<string, CrmClientLookupItem>();
    clients.forEach((client) => {
      const key = normalizeText(client.name);
      if (key && !map.has(key)) {
        map.set(key, client);
      }
    });
    return map;
  }, [clients]);

  const findMatchingClient = (lead: CrmLeadItem) => {
    const byEmail = clientsByEmail.get(normalizeText(lead.email));
    if (byEmail) return byEmail;

    const byPhone = clientsByPhone.get(normalizePhone(lead.phone));
    if (byPhone) return byPhone;

    return clientsByName.get(normalizeText(lead.clientName || lead.title));
  };

  const resolveLocationValue = (lead: CrmLeadItem, field: "city" | "state" | "country") => {
    const fromTags = readLeadTagValue(lead.tags, field).trim();
    if (fromTags) {
      return fromTags;
    }

    const matchedClient = findMatchingClient(lead);
    return (matchedClient?.[field] || "").trim();
  };

  const columnOptions: ListColumnConfig[] = [
      {
        id: "created_on",
        menuLabel: "Created on",
        headerLabel: "Created on",
        render: (lead) => formatDateValue(lead.createdAt),
      },
      {
        id: "contact",
        menuLabel: "Contact",
        headerLabel: "Email",
        render: (lead) => lead.email || "-",
      },
      {
        id: "contact_name",
        menuLabel: "Opportunity Name",
        headerLabel: "Opportunity Name",
        cellClassName: "font-semibold text-slate-900",
        render: (lead) => lead.title || lead.clientName || "-",
      },
      {
        id: "phone",
        menuLabel: "Phone",
        headerLabel: "Phone",
        render: (lead) => lead.phone || "-",
      },
      {
        id: "city",
        menuLabel: "City",
        headerLabel: "City",
        render: (lead) => resolveLocationValue(lead, "city") || "-",
      },
      {
        id: "state",
        menuLabel: "State",
        headerLabel: "State",
        render: (lead) => resolveLocationValue(lead, "state") || "-",
      },
      {
        id: "country",
        menuLabel: "Country",
        headerLabel: "Country",
        render: (lead) => resolveLocationValue(lead, "country") || "-",
      },
      {
        id: "salesperson",
        menuLabel: "Salesperson",
        headerLabel: "Handled Person",
        cellClassName: "font-semibold text-slate-900",
        render: (lead) => lead.createdByName || lead.createdByEmail || "-",
      },
      {
        id: "sales_team",
        menuLabel: "Sales Team",
        headerLabel: "Sales Team",
        render: (lead) => formatSalesTeamLabel(lead.createdByRole),
      },
      {
        id: "priority",
        menuLabel: "Priority",
        headerLabel: "Priority",
        render: (lead) => formatPriorityLabel(lead.probabilityLevel),
      },
      {
        id: "activities",
        menuLabel: "Activities",
        headerLabel: "Activities",
        render: () => (
          <div className="flex items-center gap-2 text-slate-700">
            <Clock3 className="h-4 w-4" />
            <span>0</span>
          </div>
        ),
      },
      {
        id: "activity_by",
        menuLabel: "Activity by",
        headerLabel: "Activity By",
        render: (lead) => lead.createdByName || lead.createdByEmail || "-",
      },
      {
        id: "my_deadline",
        menuLabel: "My Deadline",
        headerLabel: "My Deadline",
        render: (lead) => formatDateValue(lead.expectedClosingDate),
      },
      {
        id: "campaign",
        menuLabel: "Campaign",
        headerLabel: "Campaign",
        render: (lead) => readLeadTagValue(lead.tags, "campaign") || "-",
      },
      {
        id: "medium",
        menuLabel: "Medium",
        headerLabel: "Medium",
        render: (lead) => readLeadTagValue(lead.tags, "medium") || "-",
      },
      {
        id: "source",
        menuLabel: "Source",
        headerLabel: "Source",
        render: (lead) => readLeadTagValue(lead.tags, "source") || "-",
      },
      {
        id: "expected_revenue",
        menuLabel: "Expected Revenue",
        headerLabel: "Expected Revenue",
        headerClassName: "text-right",
        cellClassName: "text-right",
        render: (lead) => (lead.value === null ? "-" : currency.format(lead.value)),
      },
      {
        id: "stage",
        menuLabel: "Stage",
        headerLabel: "Stage",
        render: (lead) => stageLabels[lead.stage] || lead.stage || "-",
      },
    ];

  const visibleColumnIdSet = useMemo(() => new Set(visibleColumnIds), [visibleColumnIds]);

  const columnOptionsById = new Map(columnOptions.map((column) => [column.id, column]));

  const visibleColumns = visibleColumnIds
    .map((columnId) => columnOptionsById.get(columnId))
    .filter((column): column is ListColumnConfig => Boolean(column));

  const toggleColumn = (columnId: CrmLeadListColumnId, checked: boolean) => {
    setVisibleColumnIds((current) => {
      if (checked) {
        return normalizeVisibleColumnIds([...current, columnId]);
      }

      if (current.length === 1 && current.includes(columnId)) {
        return current;
      }

      return normalizeVisibleColumnIds(current.filter((id) => id !== columnId));
    });
  };

  return (
    <div className="flex h-full min-h-[420px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)]">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
            <tr className="border-b border-slate-200 text-left">
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allLeadsSelected}
                  onChange={(event) => onToggleAllLeadsSelection(event.target.checked)}
                />
              </th>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  className={cn("whitespace-nowrap px-4 py-3 font-semibold text-slate-900", column.headerClassName)}
                >
                  {column.headerLabel}
                </th>
              ))}
              <th className="w-14 px-4 py-3 text-right">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Choose list fields"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[260px] p-0">
                    <div className="border-b border-slate-200 px-4 py-3 text-left">
                      <p className="text-sm font-semibold text-slate-900">List Fields</p>
                      <p className="text-xs text-slate-500">Choose which lead details to show.</p>
                    </div>
                    <div className="max-h-[420px] space-y-1 overflow-y-auto px-2 py-2">
                      {columnOptions.map((column) => {
                        const checked = visibleColumnIdSet.has(column.id);
                        const isOnlySelected = checked && visibleColumnIds.length === 1;

                        return (
                          <label
                            key={column.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm text-slate-900 hover:bg-slate-50",
                              isOnlySelected && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isOnlySelected}
                              onChange={(event) => toggleColumn(column.id, event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                            />
                            <span>{column.menuLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="p-10 text-center text-muted-foreground">
                  No leads found
                </td>
              </tr>
            ) : (
              orderedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="h-16 cursor-pointer border-b border-slate-200/80 hover:bg-slate-50"
                  onClick={() => onOpenLeadDetails(lead.id)}
                >
                  <td className="px-4 py-3 align-middle">
                    <input
                      type="checkbox"
                      checked={visibleSelectedLeadIds.includes(lead.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onToggleLeadSelection(lead.id, event.target.checked)}
                    />
                  </td>
                  {visibleColumns.map((column) => (
                    <td
                      key={`${lead.id}-${column.id}`}
                      className={cn("whitespace-nowrap px-4 py-3 align-middle text-slate-700", column.cellClassName)}
                    >
                      {column.render(lead)}
                    </td>
                  ))}
                  <td className="px-4 py-3 align-middle text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditLead(lead)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => onRequestDelete([lead.id])}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
