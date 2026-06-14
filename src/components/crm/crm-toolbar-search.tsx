"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Filter, LayoutGrid, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchChip {
  key: string;
  label: string;
  href: string;
  icon?: "group" | "filter";
}

interface SearchSuggestion {
  id: string;
  label: string;
  description?: string;
  href: string;
}

interface CrmToolbarSearchProps {
  query: string;
  placeholder?: string;
  hiddenFields: Record<string, string>;
  chips?: SearchChip[];
  suggestions?: SearchSuggestion[];
}

export function CrmToolbarSearch({
  query,
  placeholder = "Search...",
  hiddenFields,
  chips = [],
  suggestions = [],
}: CrmToolbarSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(query);
  const [isFocused, setIsFocused] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(query);
  }, [query]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (value === query) return;
      const params = new URLSearchParams();
      Object.entries(hiddenFields).forEach(([key, fieldValue]) => {
        if (fieldValue) params.set(key, fieldValue);
      });
      if (value.trim()) {
        params.set("q", value.trim());
      }
      const next = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(next, { scroll: false });
    }, 250);

    return () => clearTimeout(handle);
  }, [hiddenFields, pathname, query, router, value]);

  const filteredSuggestions = useMemo(() => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return suggestions.slice(0, 6);
    return suggestions
      .filter((item) => {
        const haystack = `${item.label} ${item.description || ""}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [suggestions, value]);

  return (
    <div className="relative flex min-h-11 flex-1 items-stretch">
      <div
        className={cn(
          "flex min-h-11 w-full min-w-0 gap-2 px-3 sm:px-4",
          chips.length > 0 ? "items-start py-1.5" : "items-center"
        )}
      >
        <Search className={cn("h-4 w-4 shrink-0 text-slate-500", chips.length > 0 ? "mt-2" : "self-center")} />
        <div
          className={cn(
            "min-w-0 flex-1",
            chips.length > 0 ? "flex flex-wrap items-center gap-2 py-0.5" : ""
          )}
        >
          {chips.map((chip) => {
            const isGroupChip = chip.icon === "group";

            return (
              <Link
                key={chip.key}
                href={chip.href}
                className="inline-flex h-7 max-w-full shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-100 text-[11px] text-slate-700 hover:bg-slate-200"
                title="Clear this filter"
              >
                <span
                  className={cn(
                    "inline-flex w-7 shrink-0 items-center justify-center text-white",
                    isGroupChip ? "bg-teal-700" : "bg-rose-700"
                  )}
                >
                  {isGroupChip ? <LayoutGrid className="h-3 w-3" /> : <Filter className="h-3 w-3" />}
                </span>
                <span className="flex min-w-0 items-center gap-1 px-2">
                  {chip.label ? (
                    <span className="max-w-[210px] truncate whitespace-nowrap sm:max-w-[280px]">{chip.label}</span>
                  ) : null}
                  <span aria-hidden>x</span>
                </span>
              </Link>
            );
          })}
          <input
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onFocus={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
              setIsFocused(true);
            }}
            onBlur={() => {
              closeTimer.current = setTimeout(() => setIsFocused(false), 120);
            }}
            placeholder={placeholder}
            className={cn(
              "border-none bg-transparent text-sm outline-none",
              chips.length > 0
                ? "h-8 min-w-[120px] w-auto flex-[1_1_140px]"
                : "h-11 min-w-[100px] w-full flex-1 sm:min-w-[120px]"
            )}
          />
        </div>
      </div>

      {isFocused && filteredSuggestions.length > 0 ? (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Matching Results
          </div>
          <div className="max-h-80 overflow-y-auto">
            {filteredSuggestions.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="block border-b border-slate-100 px-3 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                {item.description ? (
                  <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                ) : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
