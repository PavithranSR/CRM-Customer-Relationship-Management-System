"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Plus,
  Search,
  Settings,
  Upload,
} from "lucide-react";
import type { ClientStatusFilter } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ClientTableFilters {
  collegeName: string;
  courseName: string;
  country: string;
  state: string;
  city: string;
  serviceName: string;
  projectName: string;
  tags: string;
}

interface ClientTableToolbarProps {
  canCreate: boolean;
  isPending: boolean;
  onExport: () => void;
  onOpenImport: () => void;
  onPageChange: (nextPage: number) => void;
  onSearchChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFiltersChange: (nextFilters: ClientTableFilters, nextStatus: ClientStatusFilter) => void;
  filters: ClientTableFilters;
  page: number;
  pages: number;
  search: string;
  status: ClientStatusFilter;
}

export function ClientTableToolbar({
  canCreate,
  isPending,
  onExport,
  onOpenImport,
  onPageChange,
  onSearchChange,
  onSearchSubmit,
  onFiltersChange,
  filters,
  page,
  pages,
  search,
  status,
}: ClientTableToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [draftStatus, setDraftStatus] = useState<ClientStatusFilter>(status);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => Boolean(value.trim())) || status !== "all",
    [filters, status]
  );

  const applyFilters = () => {
    onFiltersChange(draftFilters, draftStatus);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    const emptyFilters: ClientTableFilters = {
      collegeName: "",
      courseName: "",
      country: "",
      state: "",
      city: "",
      serviceName: "",
      projectName: "",
      tags: "",
    };
    setDraftFilters(emptyFilters);
    setDraftStatus("all");
    onFiltersChange(emptyFilters, "all");
    setIsFilterOpen(false);
  };

  return (
    <div className="shrink-0 border-b border-slate-200 px-4 py-4">
      <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
        <div className="flex flex-wrap items-center gap-3">
          {canCreate ? (
            <Button asChild className="bg-[#7c4a69] hover:bg-[#6d425d]">
              <Link href="/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                New
              </Link>
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10">
                <Settings className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {canCreate ? (
                <DropdownMenuItem onClick={onOpenImport}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import records
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Export records
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="text-xl font-semibold text-slate-800">Contacts</div>
        </div>
        <form onSubmit={onSearchSubmit} className="flex w-full min-w-0 xl:max-w-3xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search..."
              className="h-10 rounded-r-none border-slate-300 pl-9 focus-visible:ring-[#31a6c2]"
            />
          </div>
            <Button type="submit" variant="outline" className="h-10 rounded-l-none border-l-0">
              Search
            </Button>
          </form>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 text-sm text-slate-600">
            {pages === 0 ? "0-0 / 0" : `${page}-${pages} / ${pages}`}
          </div>
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1 || isPending}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pages || isPending}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Popover
            open={isFilterOpen}
            onOpenChange={(open) => {
              setIsFilterOpen(open);
              if (open) {
                setDraftFilters(filters);
                setDraftStatus(status);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={hasActiveFilters ? "bg-sky-50" : ""}
                title="Filter contacts"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(760px,calc(100vw-1rem))] p-0">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Filters</p>
                    <p className="text-xs text-slate-500">Choose which contact details to filter.</p>
                  </div>
                  <Button type="button" variant="ghost" className="h-8 px-3 text-sm" onClick={clearFilters}>
                    Clear all search options
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm font-medium text-slate-700">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: "all", label: "All contacts" },
                      { key: "active", label: "Active contacts" },
                      { key: "inactive", label: "Inactive contacts" },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setDraftStatus(item.key as ClientStatusFilter)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          draftStatus === item.key
                            ? "border-sky-300 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {[
                  { key: "collegeName", label: "College Name", placeholder: "Filter by college" },
                  { key: "courseName", label: "Course Name", placeholder: "Filter by course" },
                  { key: "country", label: "Country", placeholder: "Filter by country" },
                  { key: "state", label: "State", placeholder: "Filter by state" },
                  { key: "city", label: "City", placeholder: "Filter by city" },
                  { key: "serviceName", label: "Service", placeholder: "Filter by service" },
                  { key: "projectName", label: "Project", placeholder: "Filter by project" },
                  { key: "tags", label: "Tags", placeholder: "Filter by tags" },
                ].map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-slate-700" htmlFor={`filter-${field.key}`}>
                      {field.label}
                    </label>
                    <Input
                      id={`filter-${field.key}`}
                      value={draftFilters[field.key as keyof ClientTableFilters]}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          [field.key]: event.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className="h-10"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <Button type="button" variant="outline" onClick={() => setIsFilterOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={applyFilters} className="bg-[#7c4a69] hover:bg-[#6d425d]">
                  Apply filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

