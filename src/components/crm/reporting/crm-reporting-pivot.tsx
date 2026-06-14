"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  FilterX,
  Search,
  Target,
  Timer,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  CrmPivotGroupBy,
  CrmPivotLeadRow,
  CrmPivotMeasure,
  CrmPivotReportingData,
} from "@/lib/crm-pivot-reporting";
import { withInternalBackHref } from "@/lib/internal-navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type GroupSlotValue = CrmPivotGroupBy | "none";
type PivotSortMode = "measure_desc" | "measure_asc" | "label_asc" | "label_desc";

interface PivotSummary {
  expectedRevenue: number;
  wonRevenue: number;
  leadCount: number;
  daysToCloseTotal: number;
  daysToCloseCount: number;
  daysToConvertTotal: number;
  daysToConvertCount: number;
  exceededClosingDaysTotal: number;
  exceededClosingDaysCount: number;
  proratedRevenue: number;
}

interface PivotNode {
  id: string;
  label: string;
  depth: number;
  rows: CrmPivotLeadRow[];
  summary: PivotSummary;
  children: PivotNode[];
}

interface DrilldownTarget {
  label: string;
  rows: CrmPivotLeadRow[];
  summary: PivotSummary;
}

const STORAGE_KEY = "crm-reporting-pivot-ui-v1";
const DEFAULT_SELECTED_MEASURES: CrmPivotMeasure[] = [
  "expectedRevenue",
  "wonRevenue",
  "leadCount",
  "daysToClose",
  "daysToConvert",
  "exceededClosingDays",
  "proratedRevenue",
];
const DEFAULT_GROUP_SLOTS: [GroupSlotValue, GroupSlotValue, GroupSlotValue] = ["month", "country", "stage"];

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(value: Date | string | null | undefined) {
  const parsed = toDate(value);
  return parsed ? format(parsed, "dd MMM yyyy") : "-";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatDecimal(value: number) {
  return value.toFixed(2);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function createSummary(): PivotSummary {
  return {
    expectedRevenue: 0,
    wonRevenue: 0,
    leadCount: 0,
    daysToCloseTotal: 0,
    daysToCloseCount: 0,
    daysToConvertTotal: 0,
    daysToConvertCount: 0,
    exceededClosingDaysTotal: 0,
    exceededClosingDaysCount: 0,
    proratedRevenue: 0,
  };
}

function summarizeRows(rows: CrmPivotLeadRow[]) {
  return rows.reduce<PivotSummary>((acc, row) => {
    acc.expectedRevenue += row.expectedRevenue;
    acc.wonRevenue += row.wonRevenue;
    acc.leadCount += 1;
    acc.proratedRevenue += row.proratedRevenue;
    if (row.daysToClose !== null) {
      acc.daysToCloseTotal += row.daysToClose;
      acc.daysToCloseCount += 1;
    }
    if (row.daysToConvert !== null) {
      acc.daysToConvertTotal += row.daysToConvert;
      acc.daysToConvertCount += 1;
    }
    if (row.exceededClosingDays !== null) {
      acc.exceededClosingDaysTotal += row.exceededClosingDays;
      acc.exceededClosingDaysCount += 1;
    }
    return acc;
  }, createSummary());
}

function getMeasureValue(summary: PivotSummary, measure: CrmPivotMeasure) {
  switch (measure) {
    case "expectedRevenue":
      return summary.expectedRevenue;
    case "wonRevenue":
      return summary.wonRevenue;
    case "leadCount":
      return summary.leadCount;
    case "daysToClose":
      return summary.daysToCloseCount > 0 ? summary.daysToCloseTotal / summary.daysToCloseCount : 0;
    case "daysToConvert":
      return summary.daysToConvertCount > 0 ? summary.daysToConvertTotal / summary.daysToConvertCount : 0;
    case "exceededClosingDays":
      return summary.exceededClosingDaysCount > 0
        ? summary.exceededClosingDaysTotal / summary.exceededClosingDaysCount
        : 0;
    case "proratedRevenue":
      return summary.proratedRevenue;
    default:
      return 0;
  }
}

function formatMeasureValue(measure: CrmPivotMeasure, value: number) {
  if (measure === "leadCount") return String(Math.round(value));
  if (measure === "expectedRevenue" || measure === "wonRevenue" || measure === "proratedRevenue") {
    return formatCurrency(value);
  }
  return formatDecimal(value);
}

function getGroupDescriptor(row: CrmPivotLeadRow, field: CrmPivotGroupBy) {
  if (field === "month") {
    const createdAt = toDate(row.createdAt) || new Date();
    return { label: format(createdAt, "MMMM yyyy"), sortKey: format(createdAt, "yyyy-MM") };
  }
  if (field === "country") return { label: row.country || "Unknown Country", sortKey: (row.country || "Unknown Country").toLowerCase() };
  if (field === "salesperson") return { label: row.salesperson || "Unassigned", sortKey: (row.salesperson || "Unassigned").toLowerCase() };
  if (field === "team") return { label: row.team || "Unassigned", sortKey: (row.team || "Unassigned").toLowerCase() };
  if (field === "stage") return { label: row.stage || "No Stage", sortKey: (row.stage || "No Stage").toLowerCase() };
  return { label: row.leadSource || "Unknown Source", sortKey: (row.leadSource || "Unknown Source").toLowerCase() };
}

function buildPivotNodes(
  rows: CrmPivotLeadRow[],
  groupFields: CrmPivotGroupBy[],
  sortMode: PivotSortMode,
  primaryMeasure: CrmPivotMeasure,
  depth = 0,
  parentKey = "root",
): PivotNode[] {
  if (groupFields.length === 0) return [];
  const [currentField, ...restFields] = groupFields;
  const buckets = new Map<string, { label: string; sortKey: string; rows: CrmPivotLeadRow[] }>();

  rows.forEach((row) => {
    const descriptor = getGroupDescriptor(row, currentField);
    const key = `${currentField}:${descriptor.sortKey}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.rows.push(row);
      return;
    }
    buckets.set(key, { label: descriptor.label, sortKey: descriptor.sortKey, rows: [row] });
  });

  const nodes = Array.from(buckets.entries()).map(([key, bucket]) => {
    const nodeKey = `${parentKey}>${key}`;
    return {
      id: nodeKey,
      label: bucket.label,
      depth,
      rows: bucket.rows,
      summary: summarizeRows(bucket.rows),
      children: buildPivotNodes(bucket.rows, restFields, sortMode, primaryMeasure, depth + 1, nodeKey),
    };
  });

  return nodes.sort((left, right) => {
    if (sortMode === "label_asc") return left.label.localeCompare(right.label);
    if (sortMode === "label_desc") return right.label.localeCompare(left.label);
    const leftValue = getMeasureValue(left.summary, primaryMeasure);
    const rightValue = getMeasureValue(right.summary, primaryMeasure);
    if (sortMode === "measure_asc") return leftValue - rightValue || left.label.localeCompare(right.label);
    return rightValue - leftValue || left.label.localeCompare(right.label);
  });
}

function flattenPivotNodes(nodes: PivotNode[], expandedIds: Set<string>, acc: PivotNode[] = []) {
  nodes.forEach((node) => {
    acc.push(node);
    if (node.children.length > 0 && expandedIds.has(node.id)) {
      flattenPivotNodes(node.children, expandedIds, acc);
    }
  });
  return acc;
}

function collectNodeIds(nodes: PivotNode[], acc: string[] = []) {
  nodes.forEach((node) => {
    acc.push(node.id);
    collectNodeIds(node.children, acc);
  });
  return acc;
}

function rowMatchesSearch(row: CrmPivotLeadRow, query: string) {
  const target = query.trim().toLowerCase();
  if (!target) return true;
  return [
    row.title,
    row.clientName,
    row.email,
    row.phone,
    row.country,
    row.city,
    row.state,
    row.stage,
    row.salesperson,
    row.team,
    row.leadSource,
    row.campaign,
  ]
    .join(" ")
    .toLowerCase()
    .includes(target);
}

function buildExportRows(rows: CrmPivotLeadRow[]) {
  return rows.map((row) => ({
    "Opportunity Name": row.title,
    Contact: row.clientName,
    Country: row.country,
    Salesperson: row.salesperson,
    Team: row.team,
    Stage: row.stage,
    "Lead Source": row.leadSource,
    "Expected Revenue": formatCurrency(row.expectedRevenue),
    "Won Revenue": formatCurrency(row.wonRevenue),
    "Days to Close": row.daysToClose === null ? "-" : formatDecimal(row.daysToClose),
    "Days to Convert": row.daysToConvert === null ? "-" : formatDecimal(row.daysToConvert),
    "Exceeded Closing Days": row.exceededClosingDays === null ? "-" : formatDecimal(row.exceededClosingDays),
    "Prorated Revenue": formatCurrency(row.proratedRevenue),
    "Created On": formatDateValue(row.createdAt),
  }));
}

function buildCsvContent(rows: Array<Record<string, string>>) {
  const headers = Object.keys(rows[0] || {});
  const lines = rows.map((row) =>
    headers.map((header) => `"${String(row[header] ?? "").replace(/"/g, "\"\"")}"`).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}

function buildExcelContent(rows: Array<Record<string, string>>) {
  const headers = Object.keys(rows[0] || {});
  const thead = headers.map((header) => `<th>${header}</th>`).join("");
  const tbody = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${String(row[header] ?? "")}</td>`).join("")}</tr>`)
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></body></html>`;
}

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function KpiCard({
  label,
  value,
  icon: Icon,
  helper,
  accentClassName,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  helper: string;
  accentClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_35px_-24px_rgba(15,23,42,0.28)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={cn("rounded-full p-2", accentClassName)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export function CrmReportingPivot({
  report,
  basePath,
}: {
  report: CrmPivotReportingData;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPageHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);
  const [draftFilters, setDraftFilters] = useState(report.filters);
  const [selectedMeasures, setSelectedMeasures] = useState<CrmPivotMeasure[]>(DEFAULT_SELECTED_MEASURES);
  const [groupSlots, setGroupSlots] = useState<[GroupSlotValue, GroupSlotValue, GroupSlotValue]>(DEFAULT_GROUP_SLOTS);
  const [sortMode, setSortMode] = useState<PivotSortMode>("measure_desc");
  const [search, setSearch] = useState("");
  const [loadedStorage, setLoadedStorage] = useState(false);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [drilldownTarget, setDrilldownTarget] = useState<DrilldownTarget | null>(null);

  useEffect(() => {
    setDraftFilters(report.filters);
  }, [report.filters]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (!storedValue) {
        setLoadedStorage(true);
        return;
      }

      const parsed = JSON.parse(storedValue) as {
        search?: string;
        sortMode?: PivotSortMode;
        selectedMeasures?: CrmPivotMeasure[];
        groupSlots?: [GroupSlotValue, GroupSlotValue, GroupSlotValue];
      };

      if (typeof parsed.search === "string") setSearch(parsed.search);
      if (
        parsed.sortMode === "measure_desc" ||
        parsed.sortMode === "measure_asc" ||
        parsed.sortMode === "label_asc" ||
        parsed.sortMode === "label_desc"
      ) {
        setSortMode(parsed.sortMode);
      }
      if (Array.isArray(parsed.selectedMeasures) && parsed.selectedMeasures.length > 0) {
        setSelectedMeasures(parsed.selectedMeasures);
      }
      if (Array.isArray(parsed.groupSlots) && parsed.groupSlots.length === 3) {
        setGroupSlots(parsed.groupSlots);
      }
    } catch {
      // Ignore invalid stored reporting UI state.
    } finally {
      setLoadedStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!loadedStorage || typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ search, sortMode, selectedMeasures, groupSlots }),
    );
  }, [groupSlots, loadedStorage, search, selectedMeasures, sortMode]);

  const filteredRows = useMemo(
    () => report.rows.filter((row) => rowMatchesSearch(row, search)),
    [report.rows, search],
  );
  const totalSummary = useMemo(() => summarizeRows(filteredRows), [filteredRows]);
  const primaryMeasure = selectedMeasures[0] || "expectedRevenue";
  const selectedGroupFields = useMemo(() => {
    const seen = new Set<string>();
    return groupSlots.filter((slot) => {
      if (slot === "none" || seen.has(slot)) return false;
      seen.add(slot);
      return true;
    }) as CrmPivotGroupBy[];
  }, [groupSlots]);
  const pivotNodes = useMemo(
    () => buildPivotNodes(filteredRows, selectedGroupFields, sortMode, primaryMeasure),
    [filteredRows, primaryMeasure, selectedGroupFields, sortMode],
  );
  const visibleNodes = useMemo(
    () => flattenPivotNodes(pivotNodes, new Set(expandedNodeIds)),
    [expandedNodeIds, pivotNodes],
  );
  const detailRows = useMemo(() => {
    if (!drilldownTarget) return [];
    return [...drilldownTarget.rows].sort((left, right) => {
      const leftDate = toDate(left.createdAt)?.getTime() || 0;
      const rightDate = toDate(right.createdAt)?.getTime() || 0;
      return rightDate - leftDate;
    });
  }, [drilldownTarget]);
  const conversionRate =
    totalSummary.leadCount > 0 ? (filteredRows.filter((row) => row.isWon).length / totalSummary.leadCount) * 100 : 0;
  const averageDaysToClose =
    totalSummary.daysToCloseCount > 0 ? totalSummary.daysToCloseTotal / totalSummary.daysToCloseCount : 0;

  useEffect(() => {
    const nextIds = collectNodeIds(pivotNodes);
    setExpandedNodeIds((current) => {
      const available = new Set(nextIds);
      const kept = current.filter((id) => available.has(id));
      return kept.length > 0 ? kept : nextIds;
    });
  }, [pivotNodes]);

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodeIds((current) =>
      current.includes(nodeId)
        ? current.filter((id) => id !== nodeId)
        : [...current, nodeId]
    );
  };

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (draftFilters.startDate) params.set("startDate", draftFilters.startDate);
    if (draftFilters.endDate) params.set("endDate", draftFilters.endDate);
    if (draftFilters.country) params.set("country", draftFilters.country);
    if (draftFilters.stage) params.set("stage", draftFilters.stage);
    if (draftFilters.salesperson) params.set("salesperson", draftFilters.salesperson);
    if (draftFilters.team) params.set("team", draftFilters.team);
    router.push(params.toString() ? `${basePath}?${params.toString()}` : basePath);
  };

  const handleToggleMeasure = (measure: CrmPivotMeasure, checked: boolean) => {
    setSelectedMeasures((current) => {
      if (checked) return current.includes(measure) ? current : [...current, measure];
      if (current.length === 1) return current;
      return current.filter((item) => item !== measure);
    });
  };

  const handleGroupSlotChange = (index: number, nextValue: GroupSlotValue) => {
    setGroupSlots((current) => {
      const next = [...current] as [GroupSlotValue, GroupSlotValue, GroupSlotValue];
      if (nextValue !== "none") {
        next.forEach((slot, slotIndex) => {
          if (slotIndex !== index && slot === nextValue) next[slotIndex] = "none";
        });
      }
      next[index] = nextValue;
      return next;
    });
  };

  const handleExport = (formatType: "csv" | "excel") => {
    if (filteredRows.length === 0) {
      toast.error("No filtered CRM report rows available to export.");
      return;
    }

    const exportRows = buildExportRows(filteredRows);
    const fileDate = format(new Date(), "yyyy-MM-dd");
    if (formatType === "excel") {
      downloadFile(buildExcelContent(exportRows), `crm-reporting-${fileDate}.xls`, "application/vnd.ms-excel; charset=utf-8");
      return;
    }
    downloadFile(buildCsvContent(exportRows), `crm-reporting-${fileDate}.csv`, "text/csv; charset=utf-8");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.25)]">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">CRM Pivot Reporting</h1>
              <p className="mt-1 text-sm text-slate-500">
                Analyze leads, opportunities, and revenue with grouped CRM reporting similar to Odoo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    Measures
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Visible Measures</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {report.measures.map((measure) => (
                    <DropdownMenuCheckboxItem
                      key={measure.key}
                      checked={selectedMeasures.includes(measure.key)}
                      onCheckedChange={(checked) => handleToggleMeasure(measure.key, checked === true)}
                    >
                      {measure.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => handleExport("csv")}>Export CSV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")}>Export Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <form onSubmit={handleApplyFilters} className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Start Date</span>
            <input type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters((current) => ({ ...current, startDate: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">End Date</span>
            <input type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters((current) => ({ ...current, endDate: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Country</span>
            <select value={draftFilters.country} onChange={(event) => setDraftFilters((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="">All Countries</option>
              {report.options.countries.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Stage</span>
            <select value={draftFilters.stage} onChange={(event) => setDraftFilters((current) => ({ ...current, stage: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="">All Stages</option>
              {report.options.stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Salesperson</span>
            <select value={draftFilters.salesperson} onChange={(event) => setDraftFilters((current) => ({ ...current, salesperson: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="">All Salespeople</option>
              {report.options.salespeople.map((salesperson) => <option key={salesperson.id} value={salesperson.id}>{salesperson.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Team</span>
            <select value={draftFilters.team} onChange={(event) => setDraftFilters((current) => ({ ...current, team: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="">All Teams</option>
              {report.options.teams.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-6">
            <Button type="submit">Apply Filters</Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => router.push(basePath)}>
              <FilterX className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>

        <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(240px,1fr)_repeat(4,minmax(0,180px))]">
          <label className="text-sm lg:col-span-1">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search lead, country, stage, team..." className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3" />
            </div>
          </label>
          {[0, 1, 2].map((index) => (
            <label key={index} className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">{`Group ${index + 1}`}</span>
              <select value={groupSlots[index]} onChange={(event) => handleGroupSlotChange(index, event.target.value as GroupSlotValue)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                <option value="none">None</option>
                {report.groupings.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
              </select>
            </label>
          ))}
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Sort</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as PivotSortMode)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
              <option value="measure_desc">Primary Measure: High to Low</option>
              <option value="measure_asc">Primary Measure: Low to High</option>
              <option value="label_asc">Label: A to Z</option>
              <option value="label_desc">Label: Z to A</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total Leads" value={String(totalSummary.leadCount)} helper="Current filtered report rows" icon={Users} accentClassName="bg-blue-50 text-blue-600" />
        <KpiCard label="Total Expected Revenue" value={formatCurrency(totalSummary.expectedRevenue)} helper="Expected value in current scope" icon={CircleDollarSign} accentClassName="bg-emerald-50 text-emerald-600" />
        <KpiCard label="Won Deals" value={String(filteredRows.filter((row) => row.isWon).length)} helper="Closed-won opportunities" icon={Target} accentClassName="bg-cyan-50 text-cyan-600" />
        <KpiCard label="Lost Deals" value={String(filteredRows.filter((row) => row.isLost).length)} helper="Closed-lost opportunities" icon={XCircle} accentClassName="bg-rose-50 text-rose-600" />
        <KpiCard label="Average Days to Close" value={formatDecimal(averageDaysToClose)} helper="Average across closed records" icon={Timer} accentClassName="bg-amber-50 text-amber-600" />
        <KpiCard label="Conversion Rate" value={formatPercent(conversionRate)} helper="Won deals divided by filtered leads" icon={TrendingUp} accentClassName="bg-violet-50 text-violet-600" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)]">
        {filteredRows.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No CRM report data available</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              No lead, opportunity, or revenue records matched the current report filters. Adjust the filters or reset the report scope.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => router.push(basePath)}>Reset Filters</Button>
              <Button variant="outline" onClick={() => setSearch("")}>Clear Search</Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
              {filteredRows.length} lead record(s), {selectedMeasures.length} visible measure(s), grouped by{" "}
              {selectedGroupFields.length > 0
                ? selectedGroupFields.map((group) => report.groupings.find((item) => item.key === group)?.label || group).join(" / ")
                : "no grouping"}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-max min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                  <tr className="border-b border-slate-200">
                    <th className="min-w-[340px] px-4 py-3 text-left font-semibold text-slate-900">Group</th>
                    {selectedMeasures.map((measure) => (
                      <th key={measure} className="min-w-[170px] px-4 py-3 text-right font-semibold text-slate-900">
                        {report.measures.find((item) => item.key === measure)?.label || measure}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr
                    className="cursor-pointer border-b border-slate-200 bg-slate-100 font-semibold text-slate-900 hover:bg-slate-200/60"
                    onClick={() => setDrilldownTarget({ label: "Total", rows: filteredRows, summary: totalSummary })}
                  >
                    <td className="px-4 py-3">Total</td>
                    {selectedMeasures.map((measure) => (
                      <td key={measure} className="px-4 py-3 text-right">
                        {formatMeasureValue(measure, getMeasureValue(totalSummary, measure))}
                      </td>
                    ))}
                  </tr>
                  {visibleNodes.map((node) => {
                    const isExpanded = expandedNodeIds.includes(node.id);
                    const hasChildren = node.children.length > 0;

                    return (
                      <tr
                        key={node.id}
                        className="cursor-pointer border-b border-slate-100 text-slate-800 transition-colors hover:bg-slate-50"
                        onClick={() => setDrilldownTarget({ label: node.label, rows: node.rows, summary: node.summary })}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" style={{ paddingLeft: `${node.depth * 24}px` }}>
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleNode(node.id);
                                }}
                                className="rounded p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                                aria-label={isExpanded ? "Collapse group" : "Expand group"}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4" />
                            )}
                            <span className={cn("font-medium", node.depth === 0 && "text-slate-900")}>{node.label}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{node.rows.length}</span>
                          </div>
                        </td>
                        {selectedMeasures.map((measure) => (
                          <td key={measure} className="px-4 py-3 text-right">
                            {formatMeasureValue(measure, getMeasureValue(node.summary, measure))}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <Sheet open={Boolean(drilldownTarget)} onOpenChange={(open) => !open && setDrilldownTarget(null)}>
        <SheetContent side="right" className="w-full border-l border-slate-200 p-0 sm:max-w-4xl">
          {drilldownTarget ? (
            <>
              <SheetHeader className="border-b border-slate-200 bg-slate-50">
                <SheetTitle>{drilldownTarget.label}</SheetTitle>
                <SheetDescription>
                  {drilldownTarget.rows.length} matching lead record(s) inside the current CRM reporting scope.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-max min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-white">
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-4 py-3 font-semibold text-slate-900">Opportunity</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Contact</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Country</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Salesperson</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Team</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Stage</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Lead Source</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Expected Revenue</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Won Revenue</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Days to Close</th>
                        <th className="px-4 py-3 text-right font-semibold text-slate-900">Days to Convert</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <Link href={withInternalBackHref(`/crm/${row.id}`, currentPageHref)} className="hover:underline">
                              {row.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{row.clientName}</td>
                          <td className="px-4 py-3 text-slate-700">{row.country}</td>
                          <td className="px-4 py-3 text-slate-700">{row.salesperson}</td>
                          <td className="px-4 py-3 text-slate-700">{row.team}</td>
                          <td className="px-4 py-3 text-slate-700">{row.stage}</td>
                          <td className="px-4 py-3 text-slate-700">{row.leadSource}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.expectedRevenue)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(row.wonRevenue)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.daysToClose === null ? "-" : formatDecimal(row.daysToClose)}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{row.daysToConvert === null ? "-" : formatDecimal(row.daysToConvert)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDateValue(row.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
