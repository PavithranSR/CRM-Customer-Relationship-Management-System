"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { importCrmProjectTypesFromRecords, type ImportCrmProjectTypeRecordInput } from "@/actions/crm-project-types.actions";
import {
  downloadCrmProjectsTemplateFile,
  parseCrmProjectsCsvContent,
  type ImportResult,
} from "@/components/crm/crm-projects-import-export-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface CrmProjectsImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrmProjectsImportDialog({ open, onOpenChange }: CrmProjectsImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<ImportCrmProjectTypeRecordInput[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, startImportTransition] = useTransition();

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
  const visibleResults = useMemo(() => importResult?.results.slice(0, 12) ?? [], [importResult]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
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
      const parsed = parseCrmProjectsCsvContent(text);

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
      const result = await importCrmProjectTypesFromRecords(records);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      const resolvedResult = result as ImportResult;
      setImportResult(resolvedResult);
      router.refresh();

      if (resolvedResult.failedCount === 0) {
        toast.success(
          `${resolvedResult.createdCount} CRM project${resolvedResult.createdCount === 1 ? "" : "s"} imported`
        );
        onOpenChange(false);
        return;
      }

      toast.error(
        `${resolvedResult.createdCount} CRM project${resolvedResult.createdCount === 1 ? "" : "s"} imported, ${resolvedResult.failedCount} row${resolvedResult.failedCount === 1 ? "" : "s"} failed`
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl" showCloseButton>
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Import CRM Projects</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900">
                  Upload a CSV file to create CRM project records in bulk.
                </p>
                <p className="text-sm text-slate-600">
                  Required columns:
                  {" "}
                  <span className="font-medium text-slate-900">name</span>
                  {" "}
                  and
                  {" "}
                  <span className="font-medium text-slate-900">budget</span>.
                  Optional columns:
                  {" "}
                  <span className="font-medium text-slate-900">category</span>,
                  {" "}
                  <span className="font-medium text-slate-900">gst_percent</span>,
                  {" "}
                  <span className="font-medium text-slate-900">status</span>,
                  {" "}
                  <span className="font-medium text-slate-900">description</span>.
                </p>
              </div>

              <Button type="button" variant="outline" onClick={downloadCrmProjectsTemplateFile}>
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
