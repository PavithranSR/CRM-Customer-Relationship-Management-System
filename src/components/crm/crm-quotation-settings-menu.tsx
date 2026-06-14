"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CrmQuotationSettingsMenuProps {
  deletedInvoiceHref: string;
}

export function CrmQuotationSettingsMenu({ deletedInvoiceHref }: CrmQuotationSettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Quotation settings"
          className="h-8 w-8 rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={deletedInvoiceHref}>Deleted Invoice</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
