"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { format, startOfDay } from "date-fns";
import { ArrowRight } from "lucide-react";
import { updateProject } from "@/actions/project.actions";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface ProjectPlannedDateEditorProps {
  canEdit: boolean;
  expectedClosingDate: Date | string | null;
  projectId: string;
  startDate: Date | string | null;
}

function parseDateValue(value: Date | string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDate(value: Date | null) {
  return value ? format(value, "d MMM") : "Not set";
}

function formatFullDate(value: Date | null) {
  return value ? format(value, "dd/MM/yyyy") : "Not set";
}

export function ProjectPlannedDateEditor({
  canEdit,
  expectedClosingDate,
  projectId,
  startDate,
}: ProjectPlannedDateEditorProps) {
  const [isPending, startTransition] = useTransition();
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);
  const [startDateValue, setStartDateValue] = useState<Date | null>(() => parseDateValue(startDate));
  const [endDateValue, setEndDateValue] = useState<Date | null>(() => parseDateValue(expectedClosingDate));

  useEffect(() => {
    setStartDateValue(parseDateValue(startDate));
  }, [startDate]);

  useEffect(() => {
    setEndDateValue(parseDateValue(expectedClosingDate));
  }, [expectedClosingDate]);

  const startShortLabel = useMemo(() => formatShortDate(startDateValue), [startDateValue]);
  const endShortLabel = useMemo(() => formatShortDate(endDateValue), [endDateValue]);
  const startFullLabel = useMemo(() => formatFullDate(startDateValue), [startDateValue]);
  const endFullLabel = useMemo(() => formatFullDate(endDateValue), [endDateValue]);
  const minimumEndDate = useMemo(() => (startDateValue ? startOfDay(startDateValue) : null), [startDateValue]);

  const saveDate = (field: "startDate" | "expectedClosingDate", value: Date | undefined) => {
    const nextValue = value ? format(value, "yyyy-MM-dd") : "";

    startTransition(async () => {
      const formData = new FormData();
      formData.set(field, nextValue);

      const result = await updateProject(projectId, formData);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to update planned date");
        return;
      }

      toast.success("Planned date updated successfully");
      if (field === "startDate") {
        setStartPickerOpen(false);
      } else {
        setEndPickerOpen(false);
      }
    });
  };

  const dateButtonClassName =
    "inline-flex w-[120px] shrink-0 items-center justify-center border-0 border-b border-slate-300 bg-transparent px-0 pb-1 text-center text-[1.02rem] font-medium text-slate-900 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60";

  if (!canEdit) {
    return (
      <div className="grid grid-cols-[120px_auto_120px] items-center gap-3 text-[1.02rem] text-slate-700">
        <span className="w-[120px] text-center font-medium text-slate-900" title={startFullLabel}>
          {startShortLabel}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="w-[120px] text-center font-medium text-slate-900" title={endFullLabel}>
          {endShortLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[120px_auto_120px] items-center gap-3 text-[1.02rem] text-slate-700">
      <Popover open={startPickerOpen} onOpenChange={setStartPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={dateButtonClassName}
            disabled={isPending}
            title={startFullLabel}
            aria-label="Edit project start date"
          >
            {startShortLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-slate-200 bg-white p-3 shadow-lg">
          <Calendar
            mode="single"
            selected={startDateValue ?? undefined}
            onSelect={(date) => {
              setStartDateValue(date ?? null);
              saveDate("startDate", date);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />

      <Popover open={endPickerOpen} onOpenChange={setEndPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={dateButtonClassName}
            disabled={isPending}
            title={endFullLabel}
            aria-label="Edit project end date"
          >
            {endShortLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto border-slate-200 bg-white p-3 shadow-lg">
          <Calendar
            mode="single"
            selected={endDateValue ?? undefined}
            disabled={(date) => (minimumEndDate ? date <= minimumEndDate : false)}
            onSelect={(date) => {
              if (minimumEndDate && date && date <= minimumEndDate) {
                toast.error("End date must be after the start date");
                return;
              }

              setEndDateValue(date ?? null);
              saveDate("expectedClosingDate", date);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
