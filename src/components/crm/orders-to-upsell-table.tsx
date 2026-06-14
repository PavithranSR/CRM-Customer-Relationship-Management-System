"use client";

import Link from "next/link";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";

interface OrdersToUpsellRow {
  quotationId: string;
  customerName: string;
  previousProductPurchased: string;
  suggestedUpgradeProduct: string;
  salesperson: string;
  opportunityStatus: string;
  opportunityHref: string;
  contactHref: string | null;
  newSalesOrderHref: string;
}

interface OrdersToUpsellTableProps {
  rows: OrdersToUpsellRow[];
}

function getOpportunityClassName(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("priority")) {
    return "bg-violet-50 text-violet-700";
  }
  if (normalized.includes("contact")) {
    return "bg-cyan-50 text-cyan-700";
  }
  return "bg-emerald-50 text-emerald-700";
}

export function OrdersToUpsellTable({ rows }: OrdersToUpsellTableProps) {
  return (
    <CrmSelectableListTable
      rows={rows}
      columns={[
        {
          key: "customerName",
          label: "Customer Name",
          cellClassName: "font-medium text-slate-900",
          render: (row) => <Link href={row.opportunityHref} className="hover:underline">{row.customerName}</Link>,
        },
        { key: "previousProductPurchased", label: "Previous Product Purchased", render: (row) => row.previousProductPurchased },
        { key: "suggestedUpgradeProduct", label: "Suggested Upgrade Product", render: (row) => row.suggestedUpgradeProduct },
        { key: "salesperson", label: "Salesperson", render: (row) => row.salesperson },
        {
          key: "opportunityStatus",
          label: "Opportunity Status",
          render: (row) => (
            <span
              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getOpportunityClassName(row.opportunityStatus)}`}
            >
              {row.opportunityStatus}
            </span>
          ),
        },
      ]}
      emptyText="No completed purchases are currently ready for upsell follow-up."
      getRowId={(row) => row.quotationId}
      getRowLabel={(row) => row.customerName}
      selectionAriaLabel="Select all upsell rows"
      selectionEnabled={false}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.customerName}`}
            items={[
              { label: "Create Upsell Opportunity", href: row.opportunityHref },
              { label: "Contact Customer", href: row.contactHref || undefined, disabled: !row.contactHref },
              { label: "Create New Sales Order", href: row.newSalesOrderHref },
            ]}
          />
        </div>
      )}
      deleteDialogTitle={() => ""}
      deleteDialogDescription=""
      tableMinWidthClassName="min-w-[980px]"
      containerClassName="p-0"
      columnVisibilityStorageKey="crm-orders-upsell-columns"
      columnVisibilityTitle="List Fields"
      columnVisibilityDescription="Choose which upsell details to show."
    />
  );
}
