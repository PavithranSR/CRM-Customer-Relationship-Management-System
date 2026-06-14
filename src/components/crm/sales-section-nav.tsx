import Link from "next/link";
import { getModuleReportingHref } from "@/lib/module-navigation";

interface SalesSectionNavProps {
  activeTab?: "orders" | "to-invoice" | "projects" | "reporting" | "configuration";
  embedded?: boolean;
  hrefs?: Partial<Record<"orders" | "to-invoice" | "projects" | "reporting" | "configuration", string>>;
}

export function SalesSectionNav({ activeTab = "orders", embedded = false, hrefs }: SalesSectionNavProps) {
  const tabs: Array<{ key: SalesSectionNavProps["activeTab"]; label: string; href: string }> = [
    { key: "orders", label: "Quotations", href: hrefs?.orders || "/crm/quotations?tab=quotations" },
    { key: "to-invoice", label: "To Invoice", href: hrefs?.["to-invoice"] || "/crm/quotations?tab=to-invoice" },
    { key: "projects", label: "Projects", href: hrefs?.projects || "/crm/quotations?tab=projects" },
    { key: "reporting", label: "Reporting", href: hrefs?.reporting || getModuleReportingHref("SALES") },
    { key: "configuration", label: "Configuration", href: hrefs?.configuration || "/crm/quotations?tab=configuration" },
  ];

  const navContent = (
    <div className="flex flex-wrap items-center gap-6 text-base">
        <span className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="inline-block h-6 w-5 rounded-sm bg-gradient-to-t from-red-400 via-orange-400 to-amber-300" />
          <span>Sales</span>
        </span>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`rounded px-1 py-0.5 ${
              activeTab === tab.key
                ? "font-semibold text-slate-900 underline underline-offset-4"
                : "text-slate-800 hover:text-slate-900 hover:underline hover:underline-offset-4"
            }`}
          >
            {tab.label}
          </Link>
        ))}
    </div>
  );

  if (embedded) {
    return navContent;
  }

  return (
    <div className="sticky top-0 z-30 rounded-md border bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      {navContent}
    </div>
  );
}
