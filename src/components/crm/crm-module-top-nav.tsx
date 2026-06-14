"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { getModuleReportingHref } from "@/lib/module-navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type CrmModuleTopNavKey = "pipeline" | "sales" | "generate-leads" | "reporting" | "configuration";

export type CrmSalesFilterKey = "all" | "my_pipeline" | "my_quotations" | "orders" | "teams" | "customers";

const CRM_SALES_FILTER_VALUES = ["all", "my_pipeline", "my_quotations", "orders", "teams", "customers"] as const;

interface CrmModuleTopNavProps {
  activeItem?: CrmModuleTopNavKey;
  salesFilter?: CrmSalesFilterKey;
  onSalesFilterChange?: (value: CrmSalesFilterKey) => void;
  embedded?: boolean;
}

export function isCrmSalesFilterKey(value: string | null): value is CrmSalesFilterKey {
  return Boolean(value && CRM_SALES_FILTER_VALUES.includes(value as CrmSalesFilterKey));
}

export function CrmModuleTopNav({
  activeItem = "pipeline",
  salesFilter,
  onSalesFilterChange,
  embedded = false,
}: CrmModuleTopNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const salesFilterFromUrl = searchParams.get("sales");
  const isCrmHomeRoute = pathname === "/crm";
  const buildCrmHomeHref = (value?: Exclude<CrmSalesFilterKey, "all">) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (value) {
      nextParams.set("sales", value);
    } else {
      nextParams.delete("sales");
    }

    const queryString = nextParams.toString();
    return queryString ? `/crm?${queryString}` : "/crm";
  };
  const salesItems: Array<{ label: string; value: Exclude<CrmSalesFilterKey, "all">; href: string }> = [
    { label: "My Pipeline", value: "my_pipeline", href: isCrmHomeRoute ? buildCrmHomeHref("my_pipeline") : "/crm" },
    {
      label: "My Quotations",
      value: "my_quotations",
      href: isCrmHomeRoute ? buildCrmHomeHref("my_quotations") : "/crm/quotations?tab=quotations&embedded=crm",
    },
    {
      label: "Orders",
      value: "orders",
      href: isCrmHomeRoute ? buildCrmHomeHref("orders") : "/crm/quotations?tab=orders&embedded=crm",
    },
    {
      label: "Teams",
      value: "teams",
      href: isCrmHomeRoute ? buildCrmHomeHref("teams") : "/crm/quotations?tab=sales-teams&embedded=crm",
    },
    {
      label: "Customers",
      value: "customers",
      href: isCrmHomeRoute ? buildCrmHomeHref("customers") : "/crm/quotations?tab=customers&embedded=crm",
    },
  ];
  const shouldFilterInPlace = Boolean(onSalesFilterChange && salesFilter);
  const activeSalesValue =
    salesFilter ?? (isCrmHomeRoute && isCrmSalesFilterKey(salesFilterFromUrl) ? salesFilterFromUrl : "all");
  const isQuotationPath = pathname.includes("/quotations");
  const resolvedActiveItem =
    activeItem === "pipeline" && isQuotationPath ? "sales" : activeItem;
  const topItemClassName = (isActive: boolean) =>
    cn(
      "rounded-md px-1 py-0.5 text-[1.05rem] leading-none transition-colors",
      isActive
        ? "text-[1.15rem] font-semibold text-slate-950"
        : "font-medium text-slate-500 hover:text-slate-800"
    );

  const navContent = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <Link
        href={isCrmHomeRoute ? buildCrmHomeHref() : "/crm"}
        className={topItemClassName(resolvedActiveItem === "pipeline")}
      >
        CRM
      </Link>
      <Link
        href="/crm/generate-leads"
        className={topItemClassName(resolvedActiveItem === "generate-leads")}
      >
        Generate Leads
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1",
              topItemClassName(resolvedActiveItem === "sales")
            )}
          >
            Sales
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {salesItems.map((item) => {
            const isActive = activeSalesValue === item.value;
            if (shouldFilterInPlace) {
              return (
                <DropdownMenuItem
                  key={item.label}
                  onSelect={() => onSalesFilterChange?.(item.value)}
                  className={cn(isActive && "bg-muted font-semibold")}
                >
                  {item.label}
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuItem key={item.label} asChild className={cn(isActive && "bg-muted font-semibold")}>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <Link
        href={getModuleReportingHref("CRM")}
        className={topItemClassName(resolvedActiveItem === "reporting")}
      >
        Reporting
      </Link>
      <Link
        href="/crm/quotations?tab=configuration"
        className={topItemClassName(resolvedActiveItem === "configuration")}
      >
        Configuration
      </Link>
    </div>
  );

  if (embedded) {
    return navContent;
  }

  return (
    <div className="sticky top-0 z-30 shrink-0 rounded-xl border bg-card/95 px-5 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-card/90">
      {navContent}
    </div>
  );
}
