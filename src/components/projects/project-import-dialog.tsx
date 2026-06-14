"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { importProjectsFromRecords } from "@/actions/project.actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type ImportRecord = {
  rowNumber: number;
  values: Record<string, string>;
};

type ImportResult = {
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

interface ProjectImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_HEADERS = [
  "name",
  "description",
  "lead_email",
  "client_name",
  "client_email",
  "priority",
  "start_date",
  "deadline",
  "status",
  "tags",
  "service_name",
] as const;

const TEMPLATE_ROWS = [
  [
    "Hardware Project",
    "Main hardware rollout for the branch office",
    "lead@example.com",
    "Pavithran S R",
    "client@example.com",
    "HIGH",
    "2026-04-10",
    "2026-05-20",
    "PLANNING",
    "hardware, rollout",
    "Hardware",
  ],
  [
    "Website Revamp",
    "Refresh the company website and landing pages",
    "manager@example.com",
    "Office Party Ltd",
    "office@example.com",
    "MEDIUM",
    "2026-04-15",
    "2026-06-01",
    "IN_PROGRESS",
    "design, marketing",
    "Software",
  ],
] as const;

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadTemplateFile() {
  const lines = [
    TEMPLATE_HEADERS.join(","),
    ...TEMPLATE_ROWS.map((row) => row.map((cell) => escapeCsvCell(cell)).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "project-import-template.csv";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function parseCsvContent(input: string) {
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
    return { headers: [] as string[], records: [] as ImportRecord[] };
  }

  const rawHeaders = rows[0];
  const headers = rawHeaders.map((header, index) => header || `column_${index + 1}`);
  const records = rows.slice(1).map((cells, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(
      headers.map((header, headerIndex) => [header, cells[headerIndex] ?? ""])
    ),
  }));

  return { headers, records: records.filter((record) => Object.values(record.values).some(Boolean)) };
}

export function ProjectImportDialog({ open, onOpenChange }: ProjectImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, startImportTransition] = useTransition();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (open) {
      return;
    }

    setFileName("");
    setHeaders([]);
    setRecords([]);
    setParseError(null);
    setImportResult(null);
  }, [open]);

  const previewHeaders = useMemo(() => headers.slice(0, 6), [headers]);
  const previewRecords = useMemo(() => records.slice(0, 5), [records]);
  const visibleResults = useMemo(
    () => importResult?.results.slice(0, 12) ?? [],
    [importResult]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setParseError(null);
    setImportResult(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFileName(file.name);
      setHeaders([]);
      setRecords([]);
      setParseError("Please upload a CSV file");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsvContent(text);

      if (parsed.headers.length === 0 || parsed.records.length === 0) {
        setFileName(file.name);
        setHeaders([]);
        setRecords([]);
        setParseError("The CSV file is empty or does not contain any data rows");
        return;
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setRecords(parsed.records);
    } catch {
      setFileName(file.name);
      setHeaders([]);
      setRecords([]);
      setParseError("Unable to read the CSV file");
    } finally {
      event.target.value = "";
    }
  };

  const handleImport = () => {
    if (records.length === 0) {
      toast.error("Please choose a CSV file with project rows first");
      return;
    }

    startImportTransition(async () => {
      const result = await importProjectsFromRecords(records);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      const resolvedResult = result as ImportResult;

      setImportResult(resolvedResult);
      router.refresh();

      if (resolvedResult.failedCount === 0) {
        toast.success(`${resolvedResult.createdCount} project${resolvedResult.createdCount === 1 ? "" : "s"} imported`);
        onOpenChange(false);
        return;
      }

      toast.error(
        `${resolvedResult.createdCount} project${resolvedResult.createdCount === 1 ? "" : "s"} imported, ${resolvedResult.failedCount} row${resolvedResult.failedCount === 1 ? "" : "s"} failed`
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl" showCloseButton>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Import Projects</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  Upload a CSV file to create projects in bulk.
                </p>
                <p className="text-sm text-slate-600">
                  Required column: <span className="font-medium text-slate-900">name</span>.
                  Lead columns supported:
                  {" "}
                  <span className="font-medium text-slate-900">lead_email</span>,
                  {" "}
                  <span className="font-medium text-slate-900">lead_name</span>,
                  {" "}
                  <span className="font-medium text-slate-900">manager_email</span>.
                </p>
                <p className="text-sm text-slate-600">
                  Customer columns supported:
                  {" "}
                  <span className="font-medium text-slate-900">client_name</span>,
                  {" "}
                  <span className="font-medium text-slate-900">client_email</span>.
                  Imported rows create <span className="font-medium text-slate-900">TEAM</span> projects.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={downloadTemplateFile}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Choose CSV File
            </Button>
            {fileName ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{records.length} rows</Badge>
              </div>
            ) : null}
          </div>

          {parseError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {parseError}
            </div>
          ) : null}

          {records.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Preview</h3>
                  <p className="text-sm text-slate-600">
                    Showing the first {previewRecords.length} row{previewRecords.length === 1 ? "" : "s"} from the file.
                  </p>
                </div>
                {headers.length > previewHeaders.length ? (
                  <Badge variant="outline">+{headers.length - previewHeaders.length} more columns</Badge>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      {previewHeaders.map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRecords.map((record) => (
                      <TableRow key={record.rowNumber}>
                        <TableCell className="font-medium">{record.rowNumber}</TableCell>
                        {previewHeaders.map((header) => (
                          <TableCell key={`${record.rowNumber}-${header}`} className="max-w-[220px] truncate">
                            {record.values[header] || "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {importResult ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    Created {importResult.createdCount}
                  </Badge>
                  <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                    Failed {importResult.failedCount}
                  </Badge>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleResults.map((resultRow) => (
                      <TableRow key={`${resultRow.rowNumber}-${resultRow.projectName}-${resultRow.message}`}>
                        <TableCell>{resultRow.rowNumber}</TableCell>
                        <TableCell>{resultRow.projectName || "-"}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              resultRow.success
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                : "bg-rose-100 text-rose-800 hover:bg-rose-100"
                            }
                          >
                            {resultRow.success ? "Created" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell>{resultRow.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleImport} disabled={records.length === 0 || isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import Records
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
