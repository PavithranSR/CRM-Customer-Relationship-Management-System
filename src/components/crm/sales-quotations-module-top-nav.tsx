"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OrdersTabDropdown } from "@/components/crm/orders-tab-dropdown";

interface SalesQuotationsModuleTopNavProps {
  forceActiveTab?: "quotations" | "orders" | "sales-teams" | "customers" | "to-invoice" | "orders-to-invoice" | "orders-to-upsell" | "projects" | "reporting" | "configuration";
}

export function SalesQuotationsModuleTopNav({ forceActiveTab }: SalesQuotationsModuleTopNavProps = {}) {
  const searchParams = useSearchParams();
  const documentType = (searchParams.get("documentType") || "quotations").toLowerCase();
  const rawTab = (searchParams.get("tab") || "").toLowerCase();
  const normalizedTab = rawTab === "products" ? "projects" : rawTab;
  const activeTab = forceActiveTab || normalizedTab || (documentType === "sales_orders" ? "orders" : "quotations");
  const orderTabs = ["quotations", "orders", "sales-teams", "customers"] as const;
  const toInvoiceTabs = ["to-invoice", "orders-to-invoice", "orders-to-upsell"] as const;
  const isOrderTab = (orderTabs as readonly string[]).includes(activeTab);
  const selectedOrderTab = (orderTabs as readonly string[]).includes(activeTab) ? activeTab : "quotations";
  const selectedOrderLabel =
    selectedOrderTab === "quotations"
      ? "Quotations"
      : selectedOrderTab === "sales-teams"
        ? "Sales Teams"
        : selectedOrderTab === "customers"
          ? "Customers"
          : "Orders";
  const selectedToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab) ? activeTab : "to-invoice";
  const isToInvoiceTab = (toInvoiceTabs as readonly string[]).includes(activeTab);
  const selectedToInvoiceLabel =
    selectedToInvoiceTab === "orders-to-invoice"
      ? "Orders to Invoice"
      : selectedToInvoiceTab === "orders-to-upsell"
        ? "Orders to Upsell"
        : "To Invoice";

  const pageHref = (overrides?: { tab?: string; documentType?: string }) => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("from");
    const tabValue = overrides?.tab ?? activeTab;
    const documentTypeValue = overrides?.documentType ?? searchParams.get("documentType");

    next.delete("page");

    if (tabValue && tabValue !== "quotations") {
      next.set("tab", tabValue);
    } else {
      next.delete("tab");
    }

    if (documentTypeValue && documentTypeValue !== "quotations") {
      next.set("documentType", documentTypeValue);
    } else {
      next.delete("documentType");
    }

    const queryString = next.toString();
    return queryString ? `/crm/quotations?${queryString}` : "/crm/quotations";
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-base sm:gap-3">
      <span className="text-lg font-semibold text-slate-900">Sales</span>
      <OrdersTabDropdown
        selectedLabel={selectedOrderLabel}
        selectedKey={selectedOrderTab}
        active={isOrderTab}
        options={[
          { key: "quotations", label: "Quotations", href: pageHref({ tab: "quotations", documentType: "quotations" }) },
          { key: "orders", label: "Orders", href: pageHref({ tab: "orders", documentType: "sales_orders" }) },
          { key: "sales-teams", label: "Sales Teams", href: pageHref({ tab: "sales-teams", documentType: "quotations" }) },
          { key: "customers", label: "Customers", href: pageHref({ tab: "customers", documentType: "quotations" }) },
        ]}
      />
      <OrdersTabDropdown
        selectedLabel={selectedToInvoiceLabel}
        selectedKey={selectedToInvoiceTab}
        active={isToInvoiceTab}
        options={[
          { key: "to-invoice", label: "To Invoice", href: pageHref({ tab: "to-invoice", documentType: "sales_orders" }) },
          { key: "orders-to-invoice", label: "Orders to Invoice", href: pageHref({ tab: "orders-to-invoice", documentType: "sales_orders" }) },
          { key: "orders-to-upsell", label: "Orders to Upsell", href: pageHref({ tab: "orders-to-upsell", documentType: "sales_orders" }) },
        ]}
      />
      {[
        { key: "projects", label: "Projects" },
        { key: "reporting", label: "Reporting" },
        { key: "configuration", label: "Configuration" },
      ].map((tab) => (
        <Link
          key={tab.key}
          href={pageHref({ tab: tab.key })}
          className={`rounded-md px-3 py-1.5 text-[0.95rem] transition ${
            activeTab === tab.key
              ? "bg-slate-100 font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
              : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
