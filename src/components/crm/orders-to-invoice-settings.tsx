"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface OrdersToInvoiceSettingsProps {
  isToInvoiceTab: boolean;
  isQuotationTab: boolean;
  isDeletedView: boolean;
  activeHref: string;
  deletedHref: string;
  canDelete?: boolean;
}

export function OrdersToInvoiceSettings({
  isToInvoiceTab,
  isQuotationTab,
  isDeletedView,
  activeHref,
  deletedHref,
  canDelete = true,
}: OrdersToInvoiceSettingsProps) {
  const menuScope = isToInvoiceTab
    ? "invoice"
    : isQuotationTab
      ? "quotation"
      : "list";
  const menuState = isDeletedView ? "deleted" : "active";
  const triggerId = `orders-to-invoice-settings-trigger-${menuScope}-${menuState}`;
  const contentId = `orders-to-invoice-settings-content-${menuScope}-${menuState}`;

  if (!isToInvoiceTab && !isQuotationTab) {
    if (!canDelete) {
      return null;
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild id={triggerId}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded p-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
            aria-label="List settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent id={contentId} align="start" className="w-32">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-700"
            onClick={() => window.dispatchEvent(new Event("crm:list-delete-selected"))}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild id={triggerId}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded p-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
          aria-label="Invoice settings"
      >
        <Settings className="h-4 w-4" />
      </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent id={contentId} align="start" className="w-40">
        <DropdownMenuItem asChild className={!isDeletedView ? "font-semibold" : ""}>
          <Link href={activeHref}>{isToInvoiceTab ? "Active Invoices" : "Active Quotations"}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={isDeletedView ? "font-semibold" : ""}>
          <Link href={deletedHref}>{isToInvoiceTab ? "Deleted Invoices" : "Deleted Quotations"}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
