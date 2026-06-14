import {
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  Send,
  Table,
  User,
  type LucideIcon,
} from "lucide-react";
import type { CrmSalesFilterKey } from "@/components/crm/crm-module-top-nav";
import type { CustomFilterField, GroupByField, StageTheme } from "./crm-pipeline-types";

export const STAGE_THEMES: StageTheme[] = [
  {
    column: "border-cyan-200 bg-cyan-50/30",
    header: "bg-cyan-50",
    folded: "bg-gradient-to-b from-cyan-50 via-cyan-50/95 to-white",
    badge: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  {
    column: "border-blue-200 bg-blue-50/30",
    header: "bg-blue-50",
    folded: "bg-gradient-to-b from-blue-50 via-blue-50/95 to-white",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    column: "border-amber-200 bg-amber-50/30",
    header: "bg-amber-50",
    folded: "bg-gradient-to-b from-amber-50 via-amber-50/95 to-white",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    column: "border-emerald-200 bg-emerald-50/30",
    header: "bg-emerald-50",
    folded: "bg-gradient-to-b from-emerald-50 via-emerald-50/95 to-white",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    column: "border-rose-200 bg-rose-50/30",
    header: "bg-rose-50",
    folded: "bg-gradient-to-b from-rose-50 via-rose-50/95 to-white",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
  },
  {
    column: "border-violet-200 bg-violet-50/30",
    header: "bg-violet-50",
    folded: "bg-gradient-to-b from-violet-50 via-violet-50/95 to-white",
    badge: "bg-violet-100 text-violet-800 border-violet-200",
  },
];

export const GENERATE_LEAD_OPTIONS: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Lead Sourcing",
    description: "Search in our directory of companies",
    icon: User,
  },
  {
    title: "Mail Plugins",
    description: "Generate leads from incoming email",
    icon: Mail,
  },
  {
    title: "Create a Landing Page",
    description: "Turn visitors into qualified leads",
    icon: BriefcaseBusiness,
  },
  {
    title: "Email Marketing",
    description: "Send email and get leads from replies",
    icon: Send,
  },
  {
    title: "Appointments",
    description: "Capture leads from scheduled meetings",
    icon: CalendarDays,
  },
  {
    title: "Send a Survey",
    description: "Create leads from specific answers",
    icon: Table,
  },
];

export const CUSTOM_FILTER_FIELDS: Array<{ value: CustomFilterField; label: string }> = [
  { value: "country", label: "Country" },
  { value: "city", label: "City" },
  { value: "stage", label: "Stage" },
  { value: "salesperson", label: "Salesperson" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "client", label: "Customer" },
  { value: "value", label: "Expected Revenue" },
  { value: "probability", label: "Probability" },
];

export const GROUP_BY_LABELS: Record<GroupByField, string> = {
  salesperson: "Salesperson",
  sales_team: "Sales Team",
  stage: "Stage",
  city: "City",
  country: "Country",
  lost_reason: "Lost Reason",
  campaign: "Campaign",
  medium: "Medium",
  source: "Source",
};

export const SALES_FILTER_LABELS: Record<Exclude<CrmSalesFilterKey, "all">, string> = {
  my_pipeline: "My Pipeline",
  my_quotations: "My Quotations",
  orders: "Orders",
  teams: "Teams",
  customers: "Customers",
};
