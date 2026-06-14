"use client";

import type { ImportCrmProjectTypeRecordInput } from "@/actions/crm-project-types.actions";

export interface CrmProjectExportItem {
  id: string;
  name: string;
  budget: number;
  category: string | null;
  gstPercent: number;
  status: string;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type ImportResult = {
  success: boolean;
  createdCount: number;
  failedCount: number;
  results: {
    rowNumber: number;
    projectName: string;
    success: boolean;
    message: string;
  }[];
};

const TEMPLATE_HEADERS = ["name", "category", "budget", "gst_percent", "status", "description"] as const;
const TEMPLATE_ROWS = [
  ["Hardware Project", "Hardware", "15000", "18", "Active", "Main hardware rollout"],
  ["Software Project", "Software", "10000", "18", "Active", "Core software delivery"],
] as const;

function escapeCsvCell(value: string | number | null | undefined) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsvFile(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadCrmProjectsTemplateFile() {
  const lines = [
    TEMPLATE_HEADERS.join(","),
    ...TEMPLATE_ROWS.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ];

  downloadCsvFile(lines.join("\n"), "crm-projects-import-template.csv");
}

export function downloadCrmProjectsExportFile(items: CrmProjectExportItem[]) {
  const csvHeaders = ["Project", "Category", "Budget", "GST %", "Status", "Description", "Created", "Updated"];
  const csvRows = items.map((item) => [
    item.name,
    item.category || "Other",
    Number(item.budget || 0).toFixed(2),
    Number(item.gstPercent || 0).toFixed(2),
    item.status || "Active",
    item.description || "",
    new Date(item.createdAt).toLocaleDateString("en-GB"),
    new Date(item.updatedAt).toLocaleDateString("en-GB"),
  ]);

  const csvContent = [
    csvHeaders.map((header) => escapeCsvCell(header)).join(","),
    ...csvRows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ].join("\n");

  downloadCsvFile(csvContent, "crm-projects-export.csv");
}

export function parseCrmProjectsCsvContent(input: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  const text = input.replace(/^\uFEFF/, "");

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      currentCell = "";

      if (currentRow.some((cell) => cell.trim() !== "")) {
        rows.push(currentRow.map((cell) => cell.trim()));
      }

      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim() !== "")) {
    rows.push(currentRow.map((cell) => cell.trim()));
  }

  if (rows.length === 0) {
    return { headers: [] as string[], records: [] as ImportCrmProjectTypeRecordInput[] };
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map((header, index) => header || `column_${index + 1}`);
  const records = rows.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, headerIndex) => [header, cells[headerIndex] ?? ""])),
  }));

  return {
    headers,
    records: records.filter((record) => Object.values(record.values).some(Boolean)),
  };
}
