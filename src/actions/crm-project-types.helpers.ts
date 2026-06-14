export interface CrmProjectTypeItem {
  id: string;
  name: string;
  budget: number;
  category: string;
  gstPercent: number;
  status: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportCrmProjectTypeRecordInput {
  rowNumber: number;
  values: Record<string, string>;
}

export interface CrmProjectTypeUpsertInput {
  name: string;
  budget: number;
  category: string;
  gstPercent: number;
  status: string;
  description: string | null;
}

export const DEFAULT_CRM_PROJECT_TYPES: Array<{ name: string; budget: number }> = [
  { name: "Hardware Project", budget: 15000 },
  { name: "Software Project", budget: 10000 },
  { name: "Internship Project", budget: 5000 },
];

const CRM_PROJECT_IMPORT_FIELD_ALIASES = {
  name: ["name", "project", "project_name", "title"],
  budget: ["budget", "budget_amount", "amount", "price", "total_budget"],
  category: ["category", "project_category"],
  gstPercent: ["gst_percent", "gst", "tax_percent", "tax"],
  status: ["status", "project_status"],
  description: ["description", "notes"],
} as const;

export function deriveCrmProjectTypeCategory(name: string) {
  const value = name.trim().toLowerCase();
  if (value.includes("hardware")) return "Hardware";
  if (value.includes("software")) return "Software";
  if (value.includes("internship")) return "Internship";
  if (value.includes("support")) return "Support";
  return "Other";
}

export function parseCrmProjectTypeFormData(formData: FormData): CrmProjectTypeUpsertInput {
  const rawName = formData.get("name");
  const rawBudget = formData.get("budget") ?? formData.get("budgetAmount") ?? formData.get("price");
  const rawCategory = formData.get("category");
  const rawGstPercent = formData.get("gstPercent");
  const rawStatus = formData.get("status");
  const rawDescription = formData.get("description");
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const budget = Number(rawBudget || 0);
  const gstPercent = Number(rawGstPercent || 18);
  const category =
    typeof rawCategory === "string" && rawCategory.trim()
      ? rawCategory.trim()
      : deriveCrmProjectTypeCategory(name);
  const status = typeof rawStatus === "string" && rawStatus.trim() ? rawStatus.trim() : "Active";
  const description =
    typeof rawDescription === "string" && rawDescription.trim() ? rawDescription.trim() : null;

  return {
    name,
    budget,
    category,
    gstPercent,
    status,
    description,
  };
}

function normalizeImportFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function getImportField(
  normalizedRow: Record<string, string>,
  aliases: readonly string[]
) {
  for (const alias of aliases) {
    const resolved = normalizedRow[normalizeImportFieldKey(alias)];
    if (resolved && resolved.trim()) {
      return resolved.trim();
    }
  }

  return "";
}

function createNormalizedImportRow(values: Record<string, string>) {
  return Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeImportFieldKey(key)] = typeof value === "string" ? value.trim() : "";
    return acc;
  }, {});
}

export function parseImportedCrmProjectTypeRecord(record: ImportCrmProjectTypeRecordInput) {
  const normalizedRow = createNormalizedImportRow(record.values);
  const name = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.name);
  const budgetValue = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.budget);
  const categoryValue = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.category);
  const gstPercentValue = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.gstPercent);
  const statusValue = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.status);
  const descriptionValue = getImportField(normalizedRow, CRM_PROJECT_IMPORT_FIELD_ALIASES.description);
  const budget = Number(String(budgetValue || "").replace(/,/g, ""));
  const gstPercent = gstPercentValue ? Number(String(gstPercentValue).replace(/,/g, "")) : 18;

  return {
    rowNumber: record.rowNumber,
    name,
    budget,
    gstPercent,
    category: categoryValue || deriveCrmProjectTypeCategory(name),
    status: statusValue || "Active",
    description: descriptionValue || null,
  };
}

