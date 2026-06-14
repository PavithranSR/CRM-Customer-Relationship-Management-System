export const PROJECT_EXPORT_FIELD_STORAGE_KEY = "project-export-visible-fields";

export const PROJECT_EXPORT_FIELD_OPTIONS = [
  { key: "projectName", label: "Project Name" },
  { key: "code", label: "Code" },
  { key: "clientName", label: "Client Name" },
  { key: "clientCollege", label: "Client College" },
  { key: "clientEmail", label: "Client Email" },
  { key: "clientPhone", label: "Client Phone" },
  { key: "clientStreet", label: "Client Street" },
  { key: "clientAddress", label: "Client Address" },
  { key: "clientCity", label: "Client City" },
  { key: "clientZip", label: "Client ZIP" },
  { key: "clientState", label: "Client State" },
  { key: "clientCountry", label: "Client Country" },
  { key: "clientService", label: "Client Service" },
  { key: "clientProjectName", label: "Client Project Name" },
  { key: "clientTags", label: "Client Tags" },
  { key: "clientNotes", label: "Client Notes" },
  { key: "clientStatus", label: "Client Status" },
  { key: "clientQuotationNo", label: "Client Quotation No" },
  { key: "clientSourceTitle", label: "Client Source Title" },
  { key: "category", label: "Category" },
  { key: "teamLeader", label: "Team Leader" },
  { key: "manager", label: "Manager" },
  { key: "stage", label: "Stage" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "progress", label: "Progress" },
  { key: "startDate", label: "Start Date" },
  { key: "expectedClosingDate", label: "Expected Closing Date" },
  { key: "deadline", label: "Deadline" },
  { key: "estimatedHours", label: "Estimated Hours" },
  { key: "unitName", label: "Unit Name" },
  { key: "unitCount", label: "Unit Count" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "costPerUnit", label: "Cost Per Unit" },
  { key: "subtotal", label: "Subtotal" },
  { key: "gstPercent", label: "GST %" },
  { key: "gstAmount", label: "GST Amount" },
  { key: "finalAmount", label: "Final Amount" },
  { key: "profit", label: "Profit" },
  { key: "invoicingPolicy", label: "Invoicing Policy" },
  { key: "taskCount", label: "Task Count" },
  { key: "timeEntries", label: "Time Entries" },
  { key: "tags", label: "Tags" },
  { key: "teamMembers", label: "Team Members" },
] as const;

export type ProjectExportFieldKey = (typeof PROJECT_EXPORT_FIELD_OPTIONS)[number]["key"];

export const DEFAULT_PROJECT_EXPORT_FIELD_KEYS: ProjectExportFieldKey[] =
  PROJECT_EXPORT_FIELD_OPTIONS.map((option) => option.key);

export function normalizeProjectExportFieldKeys(value: unknown): ProjectExportFieldKey[] {
  const allowedKeys = new Set(PROJECT_EXPORT_FIELD_OPTIONS.map((option) => option.key));
  if (!Array.isArray(value)) {
    return DEFAULT_PROJECT_EXPORT_FIELD_KEYS;
  }

  const keys = value.filter(
    (item): item is ProjectExportFieldKey =>
      typeof item === "string" && allowedKeys.has(item as ProjectExportFieldKey)
  );

  return Array.from(new Set(keys));
}

export function readStoredProjectExportFieldKeys() {
  if (typeof window === "undefined") {
    return DEFAULT_PROJECT_EXPORT_FIELD_KEYS;
  }

  const raw = window.localStorage.getItem(PROJECT_EXPORT_FIELD_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PROJECT_EXPORT_FIELD_KEYS;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeProjectExportFieldKeys(parsed);
    return normalized.length > 0 ? normalized : DEFAULT_PROJECT_EXPORT_FIELD_KEYS;
  } catch {
    window.localStorage.removeItem(PROJECT_EXPORT_FIELD_STORAGE_KEY);
    return DEFAULT_PROJECT_EXPORT_FIELD_KEYS;
  }
}

export function writeStoredProjectExportFieldKeys(keys: ProjectExportFieldKey[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeProjectExportFieldKeys(keys);
  window.localStorage.setItem(PROJECT_EXPORT_FIELD_STORAGE_KEY, JSON.stringify(normalized));
}
