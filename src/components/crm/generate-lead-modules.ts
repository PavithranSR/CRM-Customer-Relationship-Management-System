import {
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  Send,
  Table,
  UserRoundSearch,
  type LucideIcon,
} from "lucide-react";

export type GenerateLeadModuleKey =
  | "lead-sourcing"
  | "mail-plugins"
  | "landing-page"
  | "email-marketing"
  | "appointments"
  | "survey";

export interface GenerateLeadModuleDefinition {
  key: GenerateLeadModuleKey;
  title: string;
  shortDescription: string;
  purpose: string;
  functions: string[];
  icon: LucideIcon;
  accentClassName: string;
}

export const GENERATE_LEAD_MODULES: GenerateLeadModuleDefinition[] = [
  {
    key: "lead-sourcing",
    title: "Lead Sourcing",
    shortDescription: "Search and import company information to create new leads.",
    purpose: "Search company records, review details, and turn selected businesses into CRM leads.",
    functions: [
      "Search companies from database",
      "View company details",
      "Import company contacts",
      "Create lead from selected company",
      "Assign salesperson automatically",
    ],
    icon: UserRoundSearch,
    accentClassName: "from-amber-100 via-orange-50 to-white",
  },
  {
    key: "mail-plugins",
    title: "Mail Plugins",
    shortDescription: "Convert incoming emails into CRM leads.",
    purpose: "Capture customer conversations from email channels and create leads from message context.",
    functions: [
      "Connect email account (Gmail / Outlook)",
      "Detect incoming customer emails",
      "Automatically create lead from email content",
      "Assign salesperson",
      "Store email conversation in CRM",
    ],
    icon: Mail,
    accentClassName: "from-cyan-100 via-sky-50 to-white",
  },
  {
    key: "landing-page",
    title: "Create a Landing Page",
    shortDescription: "Build landing pages to collect visitor information.",
    purpose: "Create a landing page concept, publish a shareable URL, and capture visitor submissions as leads.",
    functions: [
      "Create landing page template",
      "Add contact form fields (name, email, phone, company)",
      "Publish landing page URL",
      "Store submitted data as CRM leads",
    ],
    icon: BriefcaseBusiness,
    accentClassName: "from-emerald-100 via-lime-50 to-white",
  },
  {
    key: "email-marketing",
    title: "Email Marketing",
    shortDescription: "Send marketing campaigns and generate leads from responses.",
    purpose: "Track campaign engagement and convert marketing replies into qualified leads.",
    functions: [
      "Create email campaigns",
      "Upload contact list",
      "Send bulk emails",
      "Track open rate and click rate",
      "Convert email replies into leads",
    ],
    icon: Send,
    accentClassName: "from-fuchsia-100 via-rose-50 to-white",
  },
  {
    key: "appointments",
    title: "Appointments",
    shortDescription: "Capture leads from scheduled meetings.",
    purpose: "Create meeting bookings that immediately register a lead in the CRM pipeline.",
    functions: [
      "Provide booking calendar",
      "Allow customers to schedule meetings",
      "Store customer contact details",
      "Automatically create lead from appointment booking",
    ],
    icon: CalendarDays,
    accentClassName: "from-violet-100 via-indigo-50 to-white",
  },
  {
    key: "survey",
    title: "Send a Survey",
    shortDescription: "Generate leads based on survey responses.",
    purpose: "Collect survey submissions, qualify the responses, and convert strong responses into leads.",
    functions: [
      "Create survey forms",
      "Add multiple question types",
      "Collect responses",
      "Filter qualified responses",
      "Convert responses into CRM leads",
    ],
    icon: Table,
    accentClassName: "from-slate-100 via-zinc-50 to-white",
  },
] as const;

export function getGenerateLeadModule(key: string | null | undefined) {
  return GENERATE_LEAD_MODULES.find((module) => module.key === key) ?? GENERATE_LEAD_MODULES[0];
}
