"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  allowCreate?: boolean;
  createLabel?: string | ((value: string) => string);
  emptyText?: string;
  onSelect: (value: string) => void;
  onCreate?: (value: string) => void;
}

export function SearchableSelect({
  label,
  placeholder,
  value,
  options,
  disabled,
  allowCreate = true,
  createLabel,
  emptyText = "No matches found.",
  onSelect,
  onCreate,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedLabel = useMemo(() => {
    const matched = options.find((option) => option.value === value);
    return matched?.label || value;
  }, [options, value]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const labelMatch = option.label.toLowerCase().includes(normalizedQuery);
      const valueMatch = option.value.toLowerCase().includes(normalizedQuery);
      return labelMatch || valueMatch;
    });
  }, [normalizedQuery, options]);

  const canCreateValue =
    allowCreate &&
    !!onCreate &&
    normalizedQuery.length > 0 &&
    !options.some((option) => option.value.toLowerCase() === normalizedQuery);
  const createButtonLabel =
    typeof createLabel === "function"
      ? createLabel(query.trim())
      : createLabel || `Create "${query.trim()}"`;

  const handleCreate = () => {
    if (!onCreate) return;
    const nextValue = query.trim();
    if (!nextValue) return;
    onCreate(nextValue);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setQuery("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "h-10 w-full justify-between border-slate-200 bg-white font-normal text-slate-900",
              !value && "text-slate-400"
            )}
          >
            <span className="truncate">{selectedLabel || placeholder}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popper-anchor-width)] p-0">
          <Command>
            <CommandInput
              placeholder={`Search ${label.toLowerCase()}`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      onSelect(option.value);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} />
                    <span className="flex-1 truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {canCreateValue ? (
                <CommandGroup>
                  <CommandItem
                    value={`create ${query.trim()}`}
                    onSelect={handleCreate}
                    className="text-[#7c4a69]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{createButtonLabel}</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
