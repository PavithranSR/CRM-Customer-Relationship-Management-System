import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, IndianRupee, Loader2, Mail, Phone, Plus, Search, Star, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/actions/client.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { resolveLeadTitle } from "./crm-pipeline-utils";
import type { CrmPipelineProps } from "./crm-pipeline-types";

export interface CrmPipelineCreateLeadDialogProps {
  clients: CrmPipelineProps["clients"];
  isPending: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: FormData) => Promise<void>;
  newClientName: string;
  newEmail: string;
  newPhone: string;
  newValue: string;
  newProbabilityLevel: 1 | 2 | 3;
  newNotes: string;
  onClientNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onProbabilityChange: (value: 1 | 2 | 3) => void;
  onNotesChange: (value: string) => void;
}

const normalizeLookupValue = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const normalizePhone = (value: string | null | undefined) =>
  (value || "").replace(/\D/g, "");

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const buildQuickClientEmail = (clientName: string) => {
  const slug = clientName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client";

  return `${slug}-${Date.now()}@crm.local`;
};

export function CrmPipelineCreateLeadDialog({
  clients,
  isPending,
  open,
  onOpenChange,
  onSubmit,
  newClientName,
  newEmail,
  newPhone,
  newValue,
  newProbabilityLevel,
  newNotes,
  onClientNameChange,
  onEmailChange,
  onPhoneChange,
  onValueChange,
  onProbabilityChange,
  onNotesChange,
}: CrmPipelineCreateLeadDialogProps) {
  const router = useRouter();
  const [isQuickCreatePending, startQuickCreateTransition] = useTransition();
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [leadCreateError, setLeadCreateError] = useState("");
  const [isClientSuggestionOpen, setIsClientSuggestionOpen] = useState(false);
  const [isClientBrowserOpen, setIsClientBrowserOpen] = useState(false);
  const [clientBrowserQuery, setClientBrowserQuery] = useState("");
  const [clientOptions, setClientOptions] = useState(clients);

  useEffect(() => {
    if (open) {
      setLeadCreateError("");
    } else {
      setIsCreatingLead(false);
    }
  }, [open]);

  useEffect(() => {
    setClientOptions(clients);
  }, [clients]);

  useEffect(() => {
    if (isClientBrowserOpen) {
      setClientBrowserQuery(newClientName.trim());
    }
  }, [isClientBrowserOpen, newClientName]);

  const normalizedClientQuery = normalizeLookupValue(newClientName);
  const filteredClients = useMemo(() => {
    const sortedClients = [...clientOptions].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedClientQuery) {
      return [];
    }

    const matchedClients = sortedClients.filter((client) => {
      return normalizeLookupValue(client.name).includes(normalizedClientQuery);
    });

    matchedClients.sort((a, b) => {
      const aStartsWith = normalizeLookupValue(a.name).startsWith(normalizedClientQuery) ? 0 : 1;
      const bStartsWith = normalizeLookupValue(b.name).startsWith(normalizedClientQuery) ? 0 : 1;
      if (aStartsWith !== bStartsWith) {
        return aStartsWith - bStartsWith;
      }
      return a.name.localeCompare(b.name);
    });

    return matchedClients;
  }, [clientOptions, normalizedClientQuery]);

  const suggestionClients = useMemo(() => filteredClients.slice(0, 5), [filteredClients]);
  const hasTypedClientName = newClientName.trim().length > 0;
  const hasExactClientMatch = useMemo(
    () =>
      clientOptions.some((client) => normalizeLookupValue(client.name) === normalizedClientQuery),
    [clientOptions, normalizedClientQuery]
  );
  const shouldShowSuggestionList = hasTypedClientName && suggestionClients.length > 0;
  const shouldShowSearchMore = filteredClients.length > suggestionClients.length;
  const shouldShowCreateActions = hasTypedClientName && suggestionClients.length === 0 && !hasExactClientMatch;
  const normalizedClientBrowserQuery = normalizeLookupValue(clientBrowserQuery);
  const browserFilteredClients = useMemo(() => {
    const sortedClients = [...clientOptions].sort((a, b) => a.name.localeCompare(b.name));

    if (!normalizedClientBrowserQuery) {
      return sortedClients;
    }

    return sortedClients.filter((client) => {
      const matchesName = normalizeLookupValue(client.name).includes(normalizedClientBrowserQuery);
      const matchesEmail = normalizeLookupValue(client.email).includes(normalizedClientBrowserQuery);
      const matchesPhone = normalizePhone(client.phone).includes(normalizePhone(clientBrowserQuery));
      const matchesService = normalizeLookupValue(client.serviceName).includes(normalizedClientBrowserQuery);
      const matchesProject = normalizeLookupValue(client.projectName).includes(normalizedClientBrowserQuery);
      const matchesCity = normalizeLookupValue(client.city).includes(normalizedClientBrowserQuery);
      const matchesState = normalizeLookupValue(client.state).includes(normalizedClientBrowserQuery);
      const matchesCountry = normalizeLookupValue(client.country).includes(normalizedClientBrowserQuery);

      return (
        matchesName ||
        matchesEmail ||
        matchesPhone ||
        matchesService ||
        matchesProject ||
        matchesCity ||
        matchesState ||
        matchesCountry
      );
    });
  }, [clientBrowserQuery, clientOptions, normalizedClientBrowserQuery]);

  const selectClient = (client: CrmPipelineProps["clients"][number]) => {
    onClientNameChange(client.name);
    onEmailChange(client.email || "");
    onPhoneChange(client.phone || "");
    setIsClientSuggestionOpen(false);
    setIsClientBrowserOpen(false);
  };

  const createAndEditClient = () => {
    const params = new URLSearchParams();
    if (newClientName.trim()) params.set("name", newClientName.trim());
    if (newEmail.trim()) params.set("email", newEmail.trim());
    if (newPhone.trim()) params.set("phone", newPhone.trim());
    setIsClientSuggestionOpen(false);
    setIsClientBrowserOpen(false);
    onOpenChange(false);
    router.push(`/clients/new${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const quickCreateClient = () => {
    const trimmedName = newClientName.trim();
    if (!trimmedName) {
      toast.error("Client name is required");
      return;
    }

    startQuickCreateTransition(async () => {
      const formData = new FormData();
      formData.set("name", trimmedName);
      formData.set(
        "email",
        isValidEmail(newEmail.trim()) ? newEmail.trim() : buildQuickClientEmail(trimmedName)
      );
      formData.set("phone", newPhone.trim());
      formData.set("notes", "Quick created from CRM lead dialog");

      const result = await createClient(formData);
      if (result.error || !result.data) {
        const message =
          typeof result.error === "string"
            ? result.error
            : result.error
              ? Object.values(result.error).flat().join(", ")
              : "Unable to create client";
        toast.error(message);
        return;
      }

      const createdClient = {
        id: result.data.id,
        name: result.data.name,
        email: result.data.email,
        phone: newPhone.trim() || null,
        city: null,
        state: null,
        country: null,
        serviceName: null,
        projectName: null,
      };

      setClientOptions((current) => {
        const next = current.filter(
          (client) => normalizeLookupValue(client.name) !== normalizeLookupValue(createdClient.name)
        );
        return [...next, createdClient].sort((left, right) => left.name.localeCompare(right.name));
      });

      onClientNameChange(createdClient.name);
      onEmailChange(createdClient.email || "");
      onPhoneChange(createdClient.phone || "");
      setIsClientSuggestionOpen(false);
      setIsClientBrowserOpen(false);
      onOpenChange(false);
      toast.success("Client created");
      router.push(`/clients/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (isCreatingLead && !nextOpen) {
            return;
          }
          if (!nextOpen) {
            setLeadCreateError("");
          }
          onOpenChange(nextOpen);
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Lead</DialogTitle>
            <DialogDescription>Select an existing client first, then add the opportunity to your pipeline.</DialogDescription>
          </DialogHeader>
          <form
            autoComplete="off"
            className="space-y-4 rounded-lg border bg-white p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (isCreatingLead) return;

              const trimmedClientName = newClientName.trim();
              if (!trimmedClientName) {
                setLeadCreateError("Select or create a client first");
                toast.error("Select or create a client first");
                return;
              }

              setLeadCreateError("");
              setIsCreatingLead(true);
              try {
                const formData = new FormData(event.currentTarget);
                formData.set("clientName", trimmedClientName);
                formData.set("title", resolveLeadTitle(newClientName, newEmail));
                formData.set("email", newEmail);
                formData.set("phone", newPhone);
                formData.set("value", newValue);
                formData.set("probabilityLevel", String(newProbabilityLevel));
                formData.set("notes", newNotes);

                await onSubmit(formData);
              } catch (error) {
                const message = error instanceof Error ? error.message : "Unable to create lead";
                setLeadCreateError(message);
                toast.error(message);
              } finally {
                setIsCreatingLead(false);
              }
            }}
          >
            {leadCreateError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {leadCreateError}
              </div>
            ) : null}
            <div className="relative border-b">
                <input type="hidden" name="clientName" value={newClientName} />
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <Input
                  name="crmClientPicker"
                  placeholder="Select client"
                  disabled={isPending || isCreatingLead}
                  value={newClientName}
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={() => setIsClientSuggestionOpen(true)}
                  onBlur={() => {
                    setTimeout(() => setIsClientSuggestionOpen(false), 120);
                  }}
                  onChange={(event) => {
                    onClientNameChange(event.target.value);
                    setIsClientSuggestionOpen(true);
                  }}
                  required
                  className="h-11 rounded-none border-0 pl-10 pr-10 shadow-none focus-visible:ring-0"
                />
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />

                {isClientSuggestionOpen && shouldShowSuggestionList ? (
                  <div className="absolute left-0 top-[calc(100%-1px)] z-30 w-[320px] max-w-full overflow-hidden rounded-b-md border border-t-0 border-slate-300 bg-white shadow-lg">
                    <div className="py-1">
                      {suggestionClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          className="block w-full px-4 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-100"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectClient(client)}
                        >
                          {client.name}
                        </button>
                      ))}
                    </div>
                    {shouldShowSearchMore ? (
                      <div className="border-t border-slate-200">
                        <button
                          type="button"
                          className="block w-full px-4 py-2 text-center text-sm text-[#0b7285] transition hover:bg-slate-50"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setIsClientSuggestionOpen(false);
                            setIsClientBrowserOpen(true);
                          }}
                        >
                          Search more...
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {isClientSuggestionOpen && !shouldShowSearchMore && shouldShowCreateActions ? (
                  <div className="absolute left-0 top-[calc(100%-1px)] z-30 w-[320px] max-w-full overflow-hidden rounded-b-md border border-t-0 border-slate-300 bg-white shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-[#0b7285] transition hover:bg-slate-100"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={quickCreateClient}
                      disabled={isQuickCreatePending}
                    >
                      {isQuickCreatePending ? `Creating "${newClientName.trim()}"...` : `Create "${newClientName.trim()}"`}
                    </button>
                    <button
                      type="button"
                      className="block w-full border-t border-slate-200 px-4 py-2 text-left text-sm text-[#0b7285] transition hover:bg-slate-100"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={createAndEditClient}
                    >
                      Create and edit...
                    </button>
                  </div>
                ) : null}
            </div>

            <div className="relative border-b">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <Input
                  name="email"
                  type="email"
                  placeholder="Contact Email"
                  disabled={isPending || isCreatingLead}
                value={newEmail}
                onChange={(event) => onEmailChange(event.target.value)}
                className="h-11 rounded-none border-0 pl-10 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="relative border-b">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <Input
                  name="phone"
                  placeholder="Contact Phone"
                  disabled={isPending || isCreatingLead}
                value={newPhone}
                onChange={(event) => onPhoneChange(event.target.value)}
                className="h-11 rounded-none border-0 pl-10 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b pb-3">
              <div className="relative">
                <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <Input
                  name="value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newValue}
                  onChange={(event) => onValueChange(event.target.value)}
                  disabled={isPending || isCreatingLead}
                  className="h-10 rounded-md pl-9"
                />
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => onProbabilityChange(level as 1 | 2 | 3)}
                    disabled={isPending || isCreatingLead}
                    className="rounded p-1 disabled:cursor-not-allowed"
                    title={level === 1 ? "Low probability" : level === 2 ? "Medium probability" : "High probability"}
                    aria-label={level === 1 ? "Low probability" : level === 2 ? "Medium probability" : "High probability"}
                  >
                    <Star
                      className={`h-6 w-6 ${
                        level <= newProbabilityLevel ? "fill-amber-400 text-amber-500" : "text-slate-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Probability: {newProbabilityLevel === 1 ? "Low" : newProbabilityLevel === 2 ? "Medium" : "High"}
            </p>

            <Textarea
              name="notes"
              placeholder="Notes"
              rows={3}
              disabled={isPending || isCreatingLead}
              value={newNotes}
              onChange={(event) => onNotesChange(event.target.value)}
              className="rounded-lg"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button type="submit" disabled={isPending || isCreatingLead}>
                  {isCreatingLead ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Lead...
                    </>
                  ) : (
                    "Add"
                  )}
                </Button>
                <Button type="reset" variant="secondary" disabled={isPending || isCreatingLead}>
                  Edit
                </Button>
              </div>
              <Button type="reset" variant="outline" size="icon" className="h-10 w-10" disabled={isPending || isCreatingLead}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isClientBrowserOpen} onOpenChange={setIsClientBrowserOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Client Details</DialogTitle>
            <DialogDescription>
              {browserFilteredClients.length} client{browserFilteredClients.length === 1 ? "" : "s"} found. Select one client to use in this lead.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={clientBrowserQuery}
              onChange={(event) => setClientBrowserQuery(event.target.value)}
              placeholder="Search clients..."
              className="pl-9"
            />
          </div>

          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            {browserFilteredClients.length > 0 ? (
              browserFilteredClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-sky-200 hover:bg-sky-50/40"
                  onClick={() => selectClient(client)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900">{client.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {client.email || "No email"}{client.phone ? ` | ${client.phone}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-sky-700">Select</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>Service: {client.serviceName || "-"}</p>
                    <p>Project: {client.projectName || "-"}</p>
                    <p>City: {client.city || "-"}</p>
                    <p>State: {client.state || "-"}</p>
                    <p className="md:col-span-2">Country: {client.country || "-"}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No client details found for this name. Create the client first, then create the lead.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsClientBrowserOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={createAndEditClient}>
              Create Client
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
