import Link from "next/link";
import type { ComponentType } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  History,
  KanbanSquare,
  List,
  MapPin,
  Table2,
} from "lucide-react";

export type SalesViewKey = "list" | "kanban" | "map" | "calendar" | "table" | "chart" | "history";

interface SalesViewSwitcherProps {
  activeView: SalesViewKey;
  items: Array<{ key: SalesViewKey; label: string; href: string }>;
}

const iconByView: Record<SalesViewKey, ComponentType<{ className?: string }>> = {
  list: List,
  kanban: KanbanSquare,
  map: MapPin,
  calendar: CalendarDays,
  table: Table2,
  chart: ChartNoAxesCombined,
  history: History,
};

export function SalesViewSwitcher({ activeView, items }: SalesViewSwitcherProps) {
  return (
    <div className="flex items-center overflow-hidden rounded-md border border-slate-300">
      {items.map((view, index) => {
        const Icon = iconByView[view.key];
        return (
          <Link
            key={view.key}
            href={view.href}
            className={`inline-flex h-9 w-9 items-center justify-center ${
              index > 0 ? "border-l border-slate-300" : ""
            } ${activeView === view.key ? "bg-cyan-50 text-cyan-700" : "text-slate-700 hover:bg-slate-50"}`}
            aria-label={view.label}
          >
            <Icon className="h-4 w-4" />
          </Link>
        );
      })}
    </div>
  );
}
