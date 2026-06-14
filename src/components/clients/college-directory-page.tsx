"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Filter, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { CollegeDirectoryRow } from "@/actions/client.actions";
import { deleteStoredCollege, updateStoredCollege } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface CollegeDirectoryPageProps {
  colleges: CollegeDirectoryRow[];
}

const PAGE_SIZE = 6;

type CollegeFormState = {
  name: string;
  country: string;
  state: string;
  districtCity: string;
  placeArea: string;
  address: string;
};

const EMPTY_FORM_STATE: CollegeFormState = {
  name: "",
  country: "",
  state: "",
  districtCity: "",
  placeArea: "",
  address: "",
};

export function CollegeDirectoryPage({ colleges }: CollegeDirectoryPageProps) {
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [activeCollege, setActiveCollege] = useState<CollegeDirectoryRow | null>(null);
  const [editForm, setEditForm] = useState<CollegeFormState>(EMPTY_FORM_STATE);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/clients";
  const isPickerMode = searchParams.has("returnTo");

  const uniqueColleges = useMemo(
    () =>
      Array.from(
        new Map(colleges.map((college) => [college.name.trim().toLowerCase(), college])).values()
      ),
    [colleges]
  );

  const countryOptions = useMemo(() => {
    return Array.from(
      new Set(uniqueColleges.map((college) => college.country?.trim()).filter(Boolean) as string[])
    ).sort((left, right) => left.localeCompare(right));
  }, [uniqueColleges]);

  const stateOptions = useMemo(() => {
    return Array.from(
      new Set(
        uniqueColleges
          .filter((college) =>
            countryFilter === "all" ? true : college.country?.trim().toLowerCase() === countryFilter
          )
          .map((college) => college.state?.trim())
          .filter(Boolean) as string[]
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [countryFilter, uniqueColleges]);

  useEffect(() => {
    if (stateFilter !== "all" && !stateOptions.map((state) => state.toLowerCase()).includes(stateFilter)) {
      setStateFilter("all");
    }
  }, [stateFilter, stateOptions]);

  const filteredColleges = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return uniqueColleges.filter((college) => {
      const countryMatches =
        countryFilter === "all" || college.country?.trim().toLowerCase() === countryFilter;
      const stateMatches =
        stateFilter === "all" || college.state?.trim().toLowerCase() === stateFilter;

      if (!countryMatches || !stateMatches) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        college.name,
        college.country,
        college.state,
        college.districtCity,
        college.placeArea,
        college.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [countryFilter, query, stateFilter, uniqueColleges]);

  const totalPages = Math.max(1, Math.ceil(filteredColleges.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const visibleColleges = filteredColleges.slice(startIndex, startIndex + PAGE_SIZE);
  const rowGridClass = isPickerMode
    ? "grid-cols-[44px_2.2fr_1fr_1fr_1fr_1fr_1fr]"
    : "grid-cols-[44px_2.2fr_1fr_1fr_1fr_1fr_1fr_110px]";

  useEffect(() => {
    setPage(1);
  }, [query, countryFilter, stateFilter]);

  const handleSelectCollege = (collegeName: string) => {
    if (isPickerMode) {
      const next = new URL(returnTo, window.location.origin);
      next.searchParams.set("collegeName", collegeName);
      next.searchParams.delete("courseName");
      next.searchParams.delete("createCollege");
      router.push(`${next.pathname}${next.search}`);
      return;
    }

    const next = new URL("/clients", window.location.origin);
    next.searchParams.set("collegeName", collegeName);
    router.push(`${next.pathname}${next.search}`);
  };

  const handleCreateCollege = () => {
    if (!isPickerMode) {
      router.push("/clients/new?createCollege=1");
      return;
    }

    const next = new URL(returnTo, window.location.origin);
    next.searchParams.set("createCollege", "1");
    router.push(`${next.pathname}${next.search}`);
  };

  const goBack = () => {
    router.push(returnTo);
  };

  const openEditDialog = (college: CollegeDirectoryRow) => {
    setActiveCollege(college);
    setEditForm({
      name: college.name || "",
      country: college.country || "",
      state: college.state || "",
      districtCity: college.districtCity || "",
      placeArea: college.placeArea || "",
      address: college.address || "",
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (college: CollegeDirectoryRow) => {
    setActiveCollege(college);
    setIsDeleteDialogOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditDialogOpen(false);
    setActiveCollege(null);
    setEditForm(EMPTY_FORM_STATE);
  };

  const closeDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setActiveCollege(null);
  };

  const handleSaveCollege = async () => {
    if (!activeCollege) {
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateStoredCollege(activeCollege.id, editForm);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to update college");
        return;
      }

      toast.success("College updated successfully");
      closeEditDialog();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCollege = async () => {
    if (!activeCollege) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteStoredCollege(activeCollege.id);
      if (result.error) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to delete college");
        return;
      }

      toast.success("College deleted successfully");
      closeDeleteDialog();
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.45)]">
        <div className="shrink-0 border-b border-slate-200 px-4 py-4">
          <div className="grid gap-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xl font-semibold text-slate-800">Manage Colleges</div>
            </div>

            <form
              className="flex w-full min-w-0"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search colleges..."
                  className="h-10 rounded-r-none border-slate-300 pl-9 focus-visible:ring-[#31a6c2]"
                />
              </div>
              <Button type="submit" variant="outline" className="h-10 rounded-l-none border-l-0">
                Search
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 rounded-xl px-4">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(420px,calc(100vw-1rem))] p-0">
                  <div className="space-y-4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
                        <p className="text-sm text-slate-500">Refine the college list.</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-9 rounded-lg px-3 text-sm text-slate-600"
                        onClick={() => {
                          setCountryFilter("all");
                          setStateFilter("all");
                        }}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Country</label>
                        <Select value={countryFilter} onValueChange={(value) => setCountryFilter(value)}>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="All countries" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All countries</SelectItem>
                            {countryOptions.map((country) => (
                              <SelectItem key={country} value={country.toLowerCase()}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">State</label>
                        <Select value={stateFilter} onValueChange={(value) => setStateFilter(value)}>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="All states" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All states</SelectItem>
                            {stateOptions.map((state) => (
                              <SelectItem key={state} value={state.toLowerCase()}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="outline" onClick={goBack} className="h-10 rounded-xl px-5">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                type="button"
                onClick={handleCreateCollege}
                className="h-10 rounded-xl bg-[#2f6feb] px-5 text-base font-semibold text-white hover:bg-[#285fd0]"
              >
                <Plus className="mr-2 h-5 w-5" />
                Add New College
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <div className={`grid ${rowGridClass} border-b bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700`}>
          <div>
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" aria-label="Select all" />
          </div>
          <div>College Name</div>
          <div>Country</div>
          <div>State</div>
          <div>District</div>
          <div>Place</div>
          <div>Company Clients</div>
          {!isPickerMode ? <div className="text-right">Actions</div> : null}
        </div>

          {visibleColleges.length > 0 ? (
          visibleColleges.map((college) => (
            <div
              key={college.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectCollege(college.name)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleSelectCollege(college.name);
                }
              }}
              className={`grid cursor-pointer ${rowGridClass} items-center border-b px-4 py-5 text-sm text-slate-700 transition hover:bg-slate-50/70`}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" aria-label={`Select ${college.name}`} />
              </div>
              <div className="pr-3 font-medium text-slate-800">{college.name}</div>
              <div className="text-slate-700">{college.country || "-"}</div>
              <div className="text-slate-700">{college.state || "-"}</div>
              <div className="text-slate-700">{college.districtCity || "-"}</div>
              <div className="text-slate-700">{college.placeArea || "-"}</div>
              <div>
                <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-600">
                  {college.companyClientCount}
                </span>
              </div>
              {!isPickerMode ? (
                <div
                  className="text-right"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-10 rounded-full p-0"
                        aria-label={`Open actions for ${college.name}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={() => handleSelectCollege(college.name)}>
                        <Check className="mr-2 h-4 w-4" />
                        View Clients
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(college)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => openDeleteDialog(college)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : null}
            </div>
          ))
          ) : (
            <div className="px-6 py-14 text-center text-slate-500">No colleges found.</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-slate-600">
        <div>
          Showing {filteredColleges.length === 0 ? 0 : startIndex + 1} to{" "}
          {Math.min(startIndex + PAGE_SIZE, filteredColleges.length)} of {filteredColleges.length} colleges
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 rounded-lg p-0"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" className="h-10 w-10 rounded-lg p-0 bg-[#2f6feb] text-white">
            {currentPage}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-10 rounded-lg p-0"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => (open ? setIsEditDialogOpen(true) : closeEditDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit College</DialogTitle>
            <DialogDescription>Update the college details and save the changes.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Input
              value={editForm.name}
              onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="College name"
            />
            <Input
              value={editForm.country}
              onChange={(event) => setEditForm((current) => ({ ...current, country: event.target.value }))}
              placeholder="Country"
            />
            <Input
              value={editForm.state}
              onChange={(event) => setEditForm((current) => ({ ...current, state: event.target.value }))}
              placeholder="State"
            />
            <Input
              value={editForm.districtCity}
              onChange={(event) => setEditForm((current) => ({ ...current, districtCity: event.target.value }))}
              placeholder="District / City"
            />
            <Input
              value={editForm.placeArea}
              onChange={(event) => setEditForm((current) => ({ ...current, placeArea: event.target.value }))}
              placeholder="Place / Area"
            />
            <Input
              value={editForm.address}
              onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Address"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveCollege} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => (open ? setIsDeleteDialogOpen(true) : closeDeleteDialog())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete College</DialogTitle>
            <DialogDescription>
              This will remove <span className="font-medium text-foreground">{activeCollege?.name || "this college"}</span> from the directory.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteDialog} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteCollege} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
