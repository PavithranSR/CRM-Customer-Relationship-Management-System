"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface ProjectsModuleHeaderMenuItem {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

export interface ProjectsModuleHeaderItem {
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  menuItems?: ProjectsModuleHeaderMenuItem[];
}

interface ProjectsModuleHeaderProps {
  items: ProjectsModuleHeaderItem[];
  className?: string;
}

interface ProjectsModuleHeaderCardProps extends ProjectsModuleHeaderProps {
  wrapperClassName?: string;
}

function getItemClassName(active?: boolean, disabled?: boolean) {
  return cn(
    "transition-colors",
    disabled
      ? "cursor-not-allowed text-slate-400"
      : active
        ? "text-primary"
        : "text-slate-700 hover:text-primary"
  );
}

export function ProjectsModuleHeader({ items, className }: ProjectsModuleHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 text-sm font-medium",
        className
      )}
    >
      {items.map((item) => {
        if (item.menuItems && item.menuItems.length > 0) {
          return (
            <DropdownMenu key={item.label}>
              <DropdownMenuTrigger asChild disabled={item.disabled}>
                <button
                  type="button"
                  onClick={item.onClick}
                  disabled={item.disabled}
                  className={getItemClassName(item.active, item.disabled)}
                  suppressHydrationWarning
                >
                  {item.label}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={10}
                className="w-44 border-slate-200 bg-white p-1 text-slate-900 shadow-lg"
              >
                {item.menuItems.map((menuItem) =>
                  menuItem.href ? (
                    <DropdownMenuItem
                      key={menuItem.label}
                      asChild
                      disabled={menuItem.disabled}
                      className={cn(
                        "rounded-sm px-3 py-2 text-sm text-slate-800 focus:bg-slate-100 focus:text-slate-900",
                        menuItem.active ? "bg-slate-100 font-semibold" : ""
                      )}
                    >
                      <Link href={menuItem.href}>{menuItem.label}</Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      key={menuItem.label}
                      disabled={menuItem.disabled}
                      onSelect={(event) => {
                        if (!menuItem.onSelect) {
                          event.preventDefault();
                          return;
                        }
                        event.preventDefault();
                        menuItem.onSelect();
                      }}
                      className={cn(
                        "rounded-sm px-3 py-2 text-sm text-slate-800 focus:bg-slate-100 focus:text-slate-900",
                        menuItem.active ? "bg-slate-100 font-semibold" : ""
                      )}
                    >
                      {menuItem.label}
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }

        if (item.href) {
          return (
            <Link key={item.label} href={item.href} className={getItemClassName(item.active, item.disabled)}>
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            disabled={item.disabled}
            className={getItemClassName(item.active, item.disabled)}
            suppressHydrationWarning
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProjectsModuleHeaderCard({
  items,
  className,
  wrapperClassName,
}: ProjectsModuleHeaderCardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-3 shadow-sm", wrapperClassName)}>
      <ProjectsModuleHeader items={items} className={className} />
    </div>
  );
}
