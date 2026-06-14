import type { CrmLeadItem, CrmStageItem, LeadStage } from "@/actions/crm.actions";
import type { CrmSalesFilterKey } from "@/components/crm/crm-module-top-nav";

export interface CrmPipelineProps {
  leads: CrmLeadItem[];
  stages: CrmStageItem[];
  query: string;
  salesperson: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  salesFilter?: CrmSalesFilterKey;
  onSalesFilterChange?: (value: CrmSalesFilterKey) => void;
  clients: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }[];
}

export type ViewMode = "kanban" | "list" | "calendar";

export type SortMode = "recent" | "oldest" | "value_desc" | "value_asc" | "name_asc";

export type GroupByField =
  | "salesperson"
  | "sales_team"
  | "stage"
  | "city"
  | "country"
  | "lost_reason"
  | "campaign"
  | "medium"
  | "source";

export type GroupByDate = "creation" | "expected_closing" | "closed_date";

export type CustomFilterField =
  | "country"
  | "city"
  | "stage"
  | "salesperson"
  | "email"
  | "phone"
  | "client"
  | "value"
  | "probability";

export type CustomFilterOperator = "equals" | "contains" | "is_set" | "is_not_set" | "gt" | "lt";

export interface CustomFilterRule {
  id: string;
  field: CustomFilterField;
  operator: CustomFilterOperator;
  value: string;
}

export interface VisibleStage {
  key: LeadStage;
  label: string;
}

export interface SearchChip {
  id: string;
  label: string;
}

export interface StageTheme {
  column: string;
  header: string;
  folded: string;
  badge: string;
}

export interface GroupedPipelineStage {
  key: string;
  label: string;
  items: CrmLeadItem[];
  expectedRevenueTotal: number;
}

export interface ConfirmDialogState {
  ids: string[];
  title: string;
  detail: string;
}
