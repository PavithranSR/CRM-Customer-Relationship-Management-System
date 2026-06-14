"use client";

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  getWeek,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { CrmLeadItem } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface CrmPipelineCalendarViewProps {
  orderedLeads: CrmLeadItem[];
  stageLabels: Record<string, string>;
  selectedDate: Date;
  highlightedLeadId: string | null;
  onSelectedDateChange: (date: Date) => void;
  onOpenLeadDetails: (leadId: string) => void;
}

interface CalendarLeadItem {
  id: string;
  title: string;
  subtitle: string;
  stage: string;
  date: Date;
  usesExpectedClosingDate: boolean;
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function CrmPipelineCalendarView({
  orderedLeads,
  stageLabels,
  selectedDate,
  highlightedLeadId,
  onSelectedDateChange,
  onOpenLeadDetails,
}: CrmPipelineCalendarViewProps) {
  const monthStart = startOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let day = calendarStart; day <= calendarEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  const itemsByDay = orderedLeads.reduce<Map<string, CalendarLeadItem[]>>((acc, lead) => {
    const sourceDate = lead.expectedClosingDate || lead.createdAt;
    const date = new Date(sourceDate);
    const key = format(date, "yyyy-MM-dd");
    const currentItems = acc.get(key) ?? [];
    currentItems.push({
      id: lead.id,
      title: lead.title || lead.clientName || "Opportunity",
      subtitle: lead.clientName || lead.email || lead.phone || "-",
      stage: stageLabels[lead.stage] || lead.stage || "-",
      date,
      usesExpectedClosingDate: Boolean(lead.expectedClosingDate),
    });
    acc.set(key, currentItems);
    return acc;
  }, new Map<string, CalendarLeadItem[]>());

  const selectedDayKey = format(selectedDate, "yyyy-MM-dd");
  const selectedDayItems = itemsByDay.get(selectedDayKey) ?? [];

  return (
    <div className="flex h-full min-h-[520px] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_45px_-28px_rgba(15,23,42,0.22)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <div className="flex overflow-hidden rounded-md border border-slate-300">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-none border-r border-slate-300"
              onClick={() => onSelectedDateChange(subMonths(selectedDate, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-none"
              onClick={() => onSelectedDateChange(addMonths(selectedDate, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button type="button" variant="outline" className="h-10 gap-2" disabled>
            Month
            <ChevronDown className="h-4 w-4" />
          </Button>

          <Button type="button" variant="outline" className="h-10" onClick={() => onSelectedDateChange(new Date())}>
            Today
          </Button>

          <div className="ml-1">
            <p className="text-2xl font-semibold tracking-tight text-slate-950">{format(selectedDate, "MMMM yyyy")}</p>
            <p className="text-xs text-slate-500">
              Expected closing dates are shown first. Leads without one use their created date.
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[40px_repeat(7,minmax(0,1fr))] overflow-auto">
          <div className="sticky top-0 z-10 border-b border-r border-slate-200 bg-white" />
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="sticky top-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold tracking-wide text-slate-800 last:border-r-0"
            >
              {label}
            </div>
          ))}

          {weeks.map((week) => {
            const weekLabel = getWeek(week[0], { weekStartsOn: 0, firstWeekContainsDate: 1 });
            return (
              <div key={week[0].toISOString()} className="contents">
                <div className="border-b border-r border-slate-200 bg-slate-50 px-1 py-2 text-center text-xs font-medium text-slate-500">
                  {weekLabel}
                </div>
                {week.map((day) => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  const items = itemsByDay.get(dayKey) ?? [];
                  const isSelected = isSameDay(day, selectedDate);
                  const isOutsideMonth = !isSameMonth(day, monthStart);
                  const visibleItems = items.slice(0, 3);

                  return (
                    <div
                      key={dayKey}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onClick={() => onSelectedDateChange(day)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectedDateChange(day);
                        }
                      }}
                      className={cn(
                        "min-h-[140px] border-b border-r border-slate-200 px-2 py-2 text-left align-top transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
                        isSelected && "bg-cyan-50/70",
                        isOutsideMonth && "bg-slate-50/70 text-slate-400",
                        isToday(day) && "ring-1 ring-inset ring-cyan-500"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-full text-sm font-semibold",
                            isToday(day) && "bg-rose-500 text-white",
                            !isToday(day) && isSelected && "bg-cyan-100 text-cyan-900"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        {items.length > 0 ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {items.length}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 space-y-1">
                        {visibleItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpenLeadDetails(item.id);
                            }}
                            className={cn(
                              "block w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-xs transition hover:border-slate-300 hover:bg-slate-50",
                              item.id === highlightedLeadId && "border-cyan-300 bg-cyan-50"
                            )}
                          >
                            <p className="truncate font-semibold text-slate-900">{item.title}</p>
                            <p className="truncate text-[11px] text-slate-500">{item.stage}</p>
                          </button>
                        ))}
                        {items.length > visibleItems.length ? (
                          <p className="px-1 text-[11px] font-medium text-slate-500">
                            +{items.length - visibleItems.length} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-slate-50/60 xl:flex xl:flex-col">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-cyan-700" />
            <p className="text-sm font-semibold text-slate-900">Schedule Calendar</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Calendar
              mode="single"
              month={selectedDate}
              selected={selectedDate}
              onSelect={(date) => {
                if (date) onSelectedDateChange(date);
              }}
              className="w-full"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-3">
            <p className="text-lg font-semibold text-slate-950">{format(selectedDate, "EEE, MMM d, yyyy")}</p>
            <p className="text-xs text-slate-500">
              {selectedDayItems.length} scheduled {selectedDayItems.length === 1 ? "opportunity" : "opportunities"}
            </p>
          </div>

          <div className="space-y-2">
            {selectedDayItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                No scheduled opportunities for this day.
              </div>
            ) : (
              selectedDayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenLeadDetails(item.id)}
                  className={cn(
                    "block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50",
                    item.id === highlightedLeadId && "border-cyan-300 bg-cyan-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{item.subtitle}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {item.stage}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    {item.usesExpectedClosingDate ? "Expected closing date" : "Created date"}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
