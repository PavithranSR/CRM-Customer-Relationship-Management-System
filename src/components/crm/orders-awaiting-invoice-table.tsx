"use client";

import Link from "next/link";
import { CrmRowActionMenu } from "@/components/crm/crm-row-action-menu";
import { CrmSelectableListTable } from "@/components/crm/crm-selectable-list-table";
import { withInternalBackHref } from "@/lib/internal-navigation";

interface OrdersAwaitingInvoiceRow {
  quotationId: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  opportunityName: string;
  projectTitle: string;
  serviceName: string | null;
  product: string;
  salespersonName: string | null;
  orderStatus: string;
  orderDateLabel: string;
  totalLabel: string;
  invoiceStatus: string;
  generateInvoiceHref: string;
  viewOrderHref: string;
  sendInvoiceHref: string;
}

interface OrdersAwaitingInvoiceTableProps {
  rows: OrdersAwaitingInvoiceRow[];
  returnHref?: string;
}

function getStatusClassName(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("ready")) {
    return "bg-cyan-50 text-cyan-700";
  }
  if (normalized.includes("generated")) {
    return "bg-emerald-50 text-emerald-700";
  }
  return "bg-amber-50 text-amber-700";
}

export function OrdersAwaitingInvoiceTable({ rows, returnHref }: OrdersAwaitingInvoiceTableProps) {
  return (
    <CrmSelectableListTable
      rows={rows}
      columns={[
        {
          key: "orderId",
          label: "Order ID",
          cellClassName: "font-medium text-slate-900",
          render: (row) => (
            <Link href={withInternalBackHref(row.viewOrderHref, returnHref)} className="hover:underline">
              {row.orderId}
            </Link>
          ),
        },
        {
          key: "customerName",
          label: "Customer Name",
          render: (row) => (
            <Link href={withInternalBackHref(row.viewOrderHref, returnHref)} className="hover:underline">
              {row.customerName}
            </Link>
          ),
        },
        { key: "customerEmail", label: "Customer Email", render: (row) => row.customerEmail || "-" },
        {
          key: "opportunityName",
          label: "Opportunity Name",
          cellClassName: "max-w-[220px] truncate",
          render: (row) => row.opportunityName || "-",
        },
        {
          key: "projectTitle",
          label: "Project Title",
          cellClassName: "max-w-[220px] truncate",
          render: (row) => row.projectTitle || "-",
        },
        { key: "serviceName", label: "Service", render: (row) => row.serviceName || "-" },
        {
          key: "product",
          label: "Product",
          render: (row) => (
            <Link href={withInternalBackHref(row.viewOrderHref, returnHref)} className="hover:underline">
              {row.product}
            </Link>
          ),
        },
        { key: "salesperson", label: "Salesperson", render: (row) => row.salespersonName || "Unassigned" },
        { key: "orderStatus", label: "Order Status", render: (row) => row.orderStatus || "-" },
        { key: "orderDate", label: "Order Date", render: (row) => row.orderDateLabel },
        { key: "totalAmount", label: "Total Amount", render: (row) => row.totalLabel },
        {
          key: "invoiceStatus",
          label: "Invoice Status",
          render: (row) => (
            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusClassName(row.invoiceStatus)}`}>
              {row.invoiceStatus}
            </span>
          ),
        },
      ]}
      emptyText="No confirmed sales orders are waiting for invoice generation."
      getRowId={(row) => row.quotationId}
      getRowLabel={(row) => row.orderId}
      selectionAriaLabel="Select all orders awaiting invoice"
      selectionEnabled={false}
      renderActions={(row) => (
        <div className="flex justify-end">
          <CrmRowActionMenu
            label={`Actions for ${row.orderId}`}
            items={[
              { label: "Generate Invoice", href: withInternalBackHref(row.generateInvoiceHref, returnHref) },
              { label: "View Order Details", href: withInternalBackHref(row.viewOrderHref, returnHref) },
              { label: "Send Invoice to Customer", href: withInternalBackHref(row.sendInvoiceHref, returnHref) },
            ]}
          />
        </div>
      )}
      deleteDialogTitle={() => ""}
      deleteDialogDescription=""
      tableMinWidthClassName=""
      tableMinWidthPx={980}
      estimatedColumnMinWidthPx={155}
      containerClassName="p-0"
      compactRows
      columnVisibilityStorageKey="crm-orders-awaiting-invoice-columns"
      columnVisibilityTitle="List Fields"
      columnVisibilityDescription="Choose which order details to show."
    />
  );
}
