"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Loader2,
  Mail,
  Paperclip,
  Phone,
  Search,
  Star,
  User,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { createClient, createStoredCollege, type StoredCollegeEntry, updateClient } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCollegeLocation } from "@/lib/college-directory";
import { getDisplayClientEmail } from "@/lib/client-contact";
import { ClientFormCollegeField } from "./client-form-college-field";
import { ClientFormCreateCollegeDialog } from "./client-form-create-college-dialog";
import { ClientFormCourseField } from "./client-form-course-field";

interface ClientFormProps {
  client?: {
    id: string;
    name: string;
    collegeName: string | null;
    courseName: string | null;
    email: string;
    phone: string | null;
    street: string | null;
    city: string | null;
    zip: string | null;
    state: string | null;
    country: string | null;
    tags: string | null;
    address: string | null;
    notes: string | null;
    isActive: boolean;
  };
  colleges?: StoredCollegeEntry[];
  openCreateCollege?: boolean;
  draftValues?: {
    name?: string;
    email?: string;
    phone?: string;
    collegeName?: string;
    courseName?: string;
  };
}

export function ClientForm({ client, colleges = [], openCreateCollege = false, draftValues }: ClientFormProps) {
  const [error, setError] = useState<string | Record<string, string[]> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCollegePending, startCollegeTransition] = useTransition();
  const [previewAction, setPreviewAction] = useState<"message" | "note" | "activity">("message");
  const [showPreviewNoteBox, setShowPreviewNoteBox] = useState(false);
  const [previewNote, setPreviewNote] = useState("");
  const [isPreviewPending, setIsPreviewPending] = useState(false);
  const router = useRouter();
  const isEditing = !!client;
  const [collegeName, setCollegeName] = useState(draftValues?.collegeName ?? client?.collegeName ?? "");
  const [courseName, setCourseName] = useState(draftValues?.courseName ?? client?.courseName ?? "");
  const [isCollegeSuggestionsOpen, setIsCollegeSuggestionsOpen] = useState(false);
  const [storedColleges, setStoredColleges] = useState<StoredCollegeEntry[]>(colleges);
  const [isCreateCollegeDialogOpen, setIsCreateCollegeDialogOpen] = useState(openCreateCollege);
  const [newCollegeCountry, setNewCollegeCountry] = useState("");
  const [newCollegeState, setNewCollegeState] = useState("");
  const [newCollegeDistrictCity, setNewCollegeDistrictCity] = useState("");
  const [newCollegePlaceArea, setNewCollegePlaceArea] = useState("");
  const [newCollegeName, setNewCollegeName] = useState("");
  const filteredColleges = useMemo(() => {
    const normalizedQuery = collegeName.trim().toLowerCase();
    const uniqueNames = Array.from(
      new Map(
        storedColleges
          .map((college) => ({
            ...college,
            name: college.name.trim(),
            label: formatCollegeLocation({
              country: college.country,
              state: college.state,
              districtCity: college.districtCity,
              placeArea: college.placeArea,
              collegeName: college.name,
            }),
          }))
          .filter((college) => college.name)
          .map((college) => [college.name.toLowerCase(), college])
      ).values()
    );

    const matches = normalizedQuery
      ? uniqueNames.filter(
          (college) =>
            college.name.toLowerCase().includes(normalizedQuery) ||
            (college.label || "").toLowerCase().includes(normalizedQuery)
        )
      : uniqueNames;

    return matches.filter((college) => college.name.toLowerCase() !== collegeName.trim().toLowerCase());
  }, [collegeName, storedColleges]);
  const hasExactCollegeMatch = useMemo(
    () => storedColleges.some((college) => college.name.trim().toLowerCase() === collegeName.trim().toLowerCase()),
    [collegeName, storedColleges]
  );
  const canCreateCollege = collegeName.trim().length > 0 && !hasExactCollegeMatch;
  const topCollegeSuggestions = filteredColleges.slice(0, 5);
  const hasMoreColleges = filteredColleges.length > 5;
  const showCollegeDropdown = isCollegeSuggestionsOpen && (topCollegeSuggestions.length > 0 || canCreateCollege);
  const resetCollegeHierarchy = () => {
    setNewCollegeCountry("");
    setNewCollegeState("");
    setNewCollegeDistrictCity("");
    setNewCollegePlaceArea("");
    setNewCollegeName("");
  };

  const handleOpenCollegeDialogChange = (open: boolean) => {
    setIsCreateCollegeDialogOpen(open);
    if (!open) {
      resetCollegeHierarchy();
    }
  };

  const handleSeeMoreColleges = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/clients/colleges?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleNewCollegeCountryChange = (value: string) => {
    setNewCollegeCountry(value);
  };

  const handleNewCollegeStateChange = (value: string) => {
    setNewCollegeState(value);
  };

  const handleNewCollegeDistrictCityChange = (value: string) => {
    setNewCollegeDistrictCity(value);
  };

  const handleNewCollegePlaceAreaChange = (value: string) => {
    setNewCollegePlaceArea(value);
  };

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = isEditing
        ? await updateClient(client.id, formData)
        : await createClient(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        setError(result.error);
        toast.error(errorMessage);
        return;
      }

      toast.success(isEditing ? "Client updated successfully" : "Client created successfully");
      router.push("/clients");
    });
  }

  const handleCreateCollege = () => {
    const trimmedName = newCollegeName.trim();
    const trimmedCountry = newCollegeCountry.trim();
    const trimmedState = newCollegeState.trim();
    const trimmedDistrictCity = newCollegeDistrictCity.trim();
    const trimmedPlaceArea = newCollegePlaceArea.trim();
    if (!trimmedName) {
      toast.error("College name is required");
      return;
    }

    if (!trimmedCountry || !trimmedState || !trimmedDistrictCity || !trimmedPlaceArea) {
      toast.error("Please select country, state, district/city, and place/area");
      return;
    }

    startCollegeTransition(async () => {
      const result = await createStoredCollege({
        name: trimmedName,
        country: trimmedCountry,
        state: trimmedState,
        districtCity: trimmedDistrictCity,
        placeArea: trimmedPlaceArea,
      });

      if (result.error || !result.data) {
        toast.error(typeof result.error === "string" ? result.error : "Unable to save college");
        return;
      }

      setStoredColleges((current) => {
        const next = current.filter(
          (college) => college.name.trim().toLowerCase() !== result.data.name.trim().toLowerCase()
        );
        return [...next, result.data].sort((left, right) => left.name.localeCompare(right.name));
      });
      setCollegeName(result.data.name);
      setCourseName("");
      setIsCollegeSuggestionsOpen(false);
      handleOpenCollegeDialogChange(false);
      resetCollegeHierarchy();
      toast.success("College details saved successfully");
    });
  };

  const actionButtonClass = (isActive: boolean) =>
    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-[#7c4a69] text-white" : "bg-slate-100 text-slate-900 hover:bg-slate-200"
    }`;

  const handlePreviewSendMessage = () => {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const email = emailInput?.value?.trim();
    if (!email) {
      toast.error("Enter an email address first");
      return;
    }
    setPreviewAction("message");
    setShowPreviewNoteBox(false);
    window.location.href = `mailto:${email}?subject=Regarding%20${encodeURIComponent(
      collegeName || "New Contact"
    )}`;
  };

  const handlePreviewSaveNote = async () => {
    if (isPreviewPending) {
      return;
    }

    if (!previewNote.trim()) {
      toast.error("Write a note first");
      return;
    }

    setIsPreviewPending(true);
    try {
      setPreviewAction("note");
      setShowPreviewNoteBox(false);
      setPreviewNote("");
    } finally {
      setIsPreviewPending(false);
    }
  };

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit(new FormData(event.currentTarget));
        }}
        className="space-y-3"
      >
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {typeof error === "string" ? error : Object.values(error).flat().join(", ")}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-3">
            <Button type="submit" className="bg-[#7c4a69] hover:bg-[#6d425d]" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
              Cancel
            </Button>
            <div>
              <p className="text-xl font-semibold">{isEditing ? client.name : "New"}</p>
            </div>
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <Star className="h-4 w-4 text-[#7c4a69]" />
                <span>Opportunities 0</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                <Calendar className="h-4 w-4 text-[#7c4a69]" />
                <span>Meetings 0</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-md border bg-white">
            <div className="grid grid-cols-1 gap-6 border-b p-5 lg:grid-cols-[160px_1fr]">
              <div className="flex h-[160px] w-[160px] items-center justify-center rounded-md border bg-slate-50 text-slate-500">
                <UserRound className="h-20 w-20" />
              </div>
              <div className="space-y-3">
                <Input
                  id="name"
                  name="name"
                  defaultValue={client?.name || draftValues?.name || ""}
                  placeholder="Name (company or person)"
                  required
                  disabled={isPending}
                  className="h-14 border-0 px-0 text-5xl text-slate-500 shadow-none focus-visible:ring-0"
                />
                <div className="space-y-2 text-xl">
                  <ClientFormCollegeField
                    canCreateCollege={canCreateCollege}
                    collegeName={collegeName}
                    disabled={isPending || isCollegePending}
                    onBlur={() => {
                      window.setTimeout(() => setIsCollegeSuggestionsOpen(false), 140);
                    }}
                    onChange={(value) => {
                      setCollegeName(value);
                      setIsCollegeSuggestionsOpen(true);
                    }}
                    onCreateCollege={() => {
                      setNewCollegeName(collegeName.trim());
                      setIsCreateCollegeDialogOpen(true);
                      setIsCollegeSuggestionsOpen(false);
                    }}
                    onFocus={() => setIsCollegeSuggestionsOpen(true)}
                    onSelectCollege={(name) => {
                      setCollegeName(name);
                      setIsCollegeSuggestionsOpen(false);
                    }}
                    showCollegeDropdown={showCollegeDropdown}
                    hasMoreColleges={hasMoreColleges}
                    storedColleges={storedColleges}
                    filteredColleges={topCollegeSuggestions}
                    onSeeMoreColleges={handleSeeMoreColleges}
                  />
                  <ClientFormCourseField
                    courseName={courseName}
                    disabled={isPending || isCollegePending}
                    onChange={setCourseName}
                  />
                  <div className="flex items-center gap-2 text-slate-500">
                    <Mail className="h-5 w-5 text-[#7c4a69]" />
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={getDisplayClientEmail(client?.email) || draftValues?.email || ""}
                      placeholder="Email (optional)"
                      disabled={isPending}
                      className="h-8 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-slate-500">
                    <Phone className="h-5 w-5 text-[#7c4a69]" />
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={client?.phone || draftValues?.phone || ""}
                      placeholder="Phone (optional)"
                      disabled={isPending}
                      className="h-8 border-0 px-0 text-2xl shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-8 p-5 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-base font-semibold text-slate-700">Address</Label>
                <Input id="street" name="street" defaultValue={client?.street || ""} placeholder="Street..." disabled={isPending} />
                <Input id="address" name="address" defaultValue={client?.address || ""} placeholder="Street 2..." disabled={isPending} />
                <div className="grid grid-cols-3 gap-3">
                  <Input id="city" name="city" defaultValue={client?.city || ""} placeholder="City" disabled={isPending} />
                  <Input id="zip" name="zip" defaultValue={client?.zip || ""} placeholder="ZIP" disabled={isPending} />
                  <Input id="state" name="state" defaultValue={client?.state || ""} placeholder="State" disabled={isPending} />
                </div>
                <Input id="country" name="country" defaultValue={client?.country || ""} placeholder="Country" disabled={isPending} />
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-[130px_1fr] items-center ">
                  <Label htmlFor="tags" className="text-base font-semibold text-slate-700">Tags</Label>
                  <Input id="tags" name="tags" defaultValue={client?.tags || ""} placeholder="e.g. Student, VIP, Consulting" disabled={isPending} />
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="border-t px-5 pt-4">
                <div className="flex text-lg">
                  <div className="border-b-2 border-[#7c4a69] px-4 py-2 text-[#7c4a69]">Contacts</div>
                  <div className="border-b px-4 py-2 text-slate-700">Sales &amp; Purchase</div>
                  <div className="border-b px-4 py-2 text-slate-700">Notes</div>
                </div>
                <div className="py-5">
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={client?.notes || ""}
                    placeholder="Add notes..."
                    rows={5}
                    disabled={isPending}
                    className="max-w-xl"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-md border bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  className={actionButtonClass(previewAction === "message")}
                  onClick={handlePreviewSendMessage}
                >
                  Send message
                </button>
                <button
                  type="button"
                  className={actionButtonClass(previewAction === "note")}
                  disabled={isPreviewPending}
                  onClick={() => {
                    setPreviewAction("note");
                    setShowPreviewNoteBox((v) => !v);
                  }}
                >
                  Log note
                </button>
                <button
                  type="button"
                  className={actionButtonClass(previewAction === "activity")}
                  disabled={isPreviewPending}
                  onClick={() => {
                    setPreviewAction("activity");
                    setShowPreviewNoteBox(false);
                    document.getElementById("new-client-preview")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Activity
                </button>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Search className="h-5 w-5" />
                <Paperclip className="h-5 w-5" />
                <div className="flex items-center gap-1">
                  <User className="h-5 w-5" />
                  <span>0</span>
                </div>
              </div>
            </div>
            {showPreviewNoteBox && (
              <div className="mb-4 space-y-2 rounded-lg border border-sky-100 bg-sky-50/30 p-3">
                <Textarea
                  value={previewNote}
                  onChange={(event) => setPreviewNote(event.target.value)}
                  rows={3}
                  placeholder="Type your note..."
                  disabled={isPreviewPending}
                />
                <div className="flex justify-end">
                  <Button type="button" size="sm" onClick={handlePreviewSaveNote} disabled={isPreviewPending}>
                    {isPreviewPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save note
                  </Button>
                </div>
              </div>
            )}
            <div className="border-t pt-4 text-sm text-slate-600" id="new-client-preview">
              <p className="text-right text-slate-500">Today</p>
              <div className="mt-3 flex items-start gap-3 rounded-md border p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#c79014] font-semibold text-white">
                  {(client?.name || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{client?.name || "New Contact"}</p>
                  <p>Creating a new record...</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isEditing && <input type="hidden" name="isActive" value={client.isActive.toString()} />}
      </form>

      <ClientFormCreateCollegeDialog
        country={newCollegeCountry}
        districtCity={newCollegeDistrictCity}
        placeArea={newCollegePlaceArea}
        name={newCollegeName}
        onCountryChange={handleNewCollegeCountryChange}
        onDistrictCityChange={handleNewCollegeDistrictCityChange}
        onOpenChange={handleOpenCollegeDialogChange}
        onPlaceAreaChange={handleNewCollegePlaceAreaChange}
        onNameChange={setNewCollegeName}
        onStateChange={handleNewCollegeStateChange}
        onSubmit={handleCreateCollege}
        selectedState={newCollegeState}
        open={isCreateCollegeDialogOpen}
        pending={isCollegePending}
      />
    </>
  );
}
