"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface CrmRowActionMenuItem {
  label: string;
  onClick?: () => void;
  href?: string;
  destructive?: boolean;
  disabled?: boolean;
}

interface CrmRowActionMenuProps {
  label: string;
  items: CrmRowActionMenuItem[];
}

export function CrmRowActionMenu({ label, items }: CrmRowActionMenuProps) {
  const visibleItems = items.filter((item) => item.label.trim().length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {visibleItems.map((item) => (
          item.href ? (
            <DropdownMenuItem
              key={`${item.label}-${item.href}`}
              asChild
              disabled={item.disabled}
              className={item.destructive ? "text-red-600 focus:text-red-700" : undefined}
              onSelect={(event) => event.stopPropagation()}
            >
              <Link href={item.href} onClick={(event) => event.stopPropagation()}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={`${item.label}-action`}
              disabled={item.disabled}
              className={item.destructive ? "text-red-600 focus:text-red-700" : undefined}
              onSelect={(event) => {
                event.preventDefault();
                event.stopPropagation();
                item.onClick?.();
              }}
            >
              <span>{item.label}</span>
            </DropdownMenuItem>
          )
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
