import type { CrmLeadItem } from "@/actions/crm.actions";
import type { CustomFilterRule } from "./crm-pipeline-types";

const LEAD_AVATAR_COLOR_CLASSES = [
  "bg-warning",
  "bg-primary",
  "bg-success",
  "bg-danger",
  "bg-secondary",
  "bg-info",
  "bg-warning",
  "bg-slate-700",
] as const;

let customRuleIdCounter = 0;

export const getLeadAvatarColorClass = (value: string) => {
  const seed = value.trim();
  if (!seed) return LEAD_AVATAR_COLOR_CLASSES[0];

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return LEAD_AVATAR_COLOR_CLASSES[hash % LEAD_AVATAR_COLOR_CLASSES.length];
};

export const normalizeText = (value: string | null | undefined) => (value || "").trim().toLowerCase();

export const normalizePhone = (value: string | null | undefined) => (value || "").replace(/\D/g, "");

export const getDefaultCustomRule = (): CustomFilterRule => ({
  id: `crm-custom-rule-${++customRuleIdCounter}`,
  field: "country",
  operator: "contains",
  value: "",
});

export const isCustomFilterRuleComplete = (rule: CustomFilterRule) =>
  rule.operator === "is_set" || rule.operator === "is_not_set" || rule.value.trim().length > 0;

export const toErrorMessage = (error: unknown) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    return Object.values(error as Record<string, string[] | undefined>)
      .flat()
      .filter(Boolean)
      .join(", ");
  }
  return "Something went wrong";
};

export const resolveLeadTitle = (clientName: string, email: string) => {
  const trimmedClientName = clientName.trim();
  if (trimmedClientName) {
    return /\bopportunity\b/i.test(trimmedClientName)
      ? trimmedClientName
      : `${trimmedClientName}'s opportunity`;
  }

  return email.trim() || "New opportunity";
};

export const buildCrmCsvContent = (leads: CrmLeadItem[]) => {
  const header = ["Title", "Handled Person", "Email", "Phone", "Value", "Stage", "Updated At"];
  const rows = leads.map((lead) => [
    lead.title,
    lead.clientName || "",
    lead.email || "",
    lead.phone || "",
    lead.value ?? "",
    lead.stage,
    new Date(lead.updatedAt).toISOString(),
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");
};
