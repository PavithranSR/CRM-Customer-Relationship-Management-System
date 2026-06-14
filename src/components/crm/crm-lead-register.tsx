"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateCrmLead, type CrmLeadItem } from "@/actions/crm.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CrmLeadRegisterProps {
  lead: CrmLeadItem;
  clients: {
    name: string;
    email: string;
    phone: string | null;
    street: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }[];
  initialTab?: "notes" | "extra";
  backHref?: string;
}

const CLIENT_META_PREFIX = "__client_meta__:";

const normalizeText = (value: string | null | undefined) =>
  (value || "").trim().toLowerCase();

const normalizePhone = (value: string | null | undefined) =>
  (value || "").replace(/\D/g, "");

const findMatchingClient = (
  clients: CrmLeadRegisterProps["clients"],
  nameValue: string,
  emailValue: string,
  phoneValue: string
) => {
  const name = normalizeText(nameValue);
  const email = normalizeText(emailValue);
  const phone = normalizePhone(phoneValue);

  return (
    clients.find((client) => normalizeText(client.name) === name) ||
    clients.find((client) => normalizeText(client.email) === email) ||
    clients.find((client) => normalizePhone(client.phone) === phone)
  );
};

const parseClientMetaFromTags = (tags: string | null | undefined) => {
  if (!tags) return null;
  const markerIndex = tags.indexOf(CLIENT_META_PREFIX);
  if (markerIndex === -1) return null;
  const payload = tags.slice(markerIndex + CLIENT_META_PREFIX.length).trim();
  if (!payload) return null;
  try {
    return JSON.parse(payload) as {
      addressLine1?: string;
      addressLine2?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  } catch {
    return null;
  }
};

const stripClientMetaFromTags = (tags: string | null | undefined) => {
  if (!tags) return "";
  const markerIndex = tags.indexOf(CLIENT_META_PREFIX);
  if (markerIndex === -1) return tags.trim();
  return tags.slice(0, markerIndex).trim();
};

export function CrmLeadRegister({
  lead,
  clients,
  initialTab = "notes",
  backHref = "/crm",
}: CrmLeadRegisterProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const clientMeta = parseClientMetaFromTags(lead.tags);
  const plainTags = stripClientMetaFromTags(lead.tags);
  const matchedClient = findMatchingClient(
    clients,
    lead.clientName || "",
    lead.email || "",
    lead.phone || ""
  );
  const [activeTab, setActiveTab] = useState<"notes" | "extra">(initialTab);
  const [clientName, setClientName] = useState(lead.clientName || matchedClient?.name || "");
  const [email, setEmail] = useState(lead.email || matchedClient?.email || "");
  const [phone, setPhone] = useState(lead.phone || matchedClient?.phone || "");
  const [addressLine1, setAddressLine1] = useState(clientMeta?.addressLine1 || matchedClient?.street || "");
  const [addressLine2, setAddressLine2] = useState(clientMeta?.addressLine2 || matchedClient?.address || "");
  const [city, setCity] = useState(clientMeta?.city || matchedClient?.city || "");
  const [stateName, setStateName] = useState(clientMeta?.state || matchedClient?.state || "");
  const [zipCode, setZipCode] = useState(clientMeta?.zipCode || matchedClient?.zip || "");
  const [country, setCountry] = useState(clientMeta?.country || matchedClient?.country || "");
  const [notes, setNotes] = useState(lead.notes || "");

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const autoFillFromClient = (value: string) => {
    const matched = findMatchingClient(clients, value, email, phone);
    if (!matched) return;

    setEmail(matched.email || "");
    setPhone(matched.phone || "");
    setAddressLine1(matched.street || "");
    setAddressLine2(matched.address || "");
    setCity(matched.city || "");
    setStateName(matched.state || "");
    setZipCode(matched.zip || "");
    setCountry(matched.country || "");
  };

  const handleSubmit = (formData: FormData) => {
    formData.set("clientName", clientName);
    formData.set("email", email);
    formData.set("phone", phone);
    formData.set("notes", notes);
    const nextTags = `${plainTags}${plainTags ? " " : ""}${CLIENT_META_PREFIX}${JSON.stringify({
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      state: stateName.trim(),
      zipCode: zipCode.trim(),
      country: country.trim(),
    })}`;
    if (nextTags.length > 200) {
      toast.error("Address details are too long. Please shorten address fields.");
      return;
    }
    formData.set("tags", nextTags);

    startTransition(async () => {
      const result = await updateCrmLead(lead.id, formData);
      if (result.error) {
        const msg = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(msg);
        return;
      }
      toast.success("CRM register updated");
      router.refresh();
    });
  };

  return (
    <form id="crm-lead-register" action={handleSubmit} className="space-y-4 bg-white">
      <div className="flex items-end border-b px-4 pt-3">
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`border px-4 py-2 text-xl ${activeTab === "notes" ? "border-b-white border-t-[#7c4a69] border-x-slate-300 border-t-2 text-[#7c4a69]" : "border-slate-300 bg-slate-50 text-slate-800"}`}
        >
          Notes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("extra")}
          className={`-ml-px border px-4 py-2 text-xl ${activeTab === "extra" ? "border-b-white border-t-[#7c4a69] border-x-slate-300 border-t-2 text-[#7c4a69]" : "border-slate-300 bg-slate-50 text-slate-800"}`}
        >
          Extra Info
        </button>
      </div>

      <div className="px-4 pb-4">
        {activeTab === "notes" ? (
          <div className="space-y-2">
            <Label className="text-slate-500">Add a description...</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={8} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={clientName}
                onChange={(e) => {
                  const value = e.target.value;
                  setClientName(value);
                  autoFillFromClient(value);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 1</Label>
              <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 2</Label>
              <Input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 border-t px-4 pb-4 pt-3">
        <Button type="submit" disabled={isPending}>Save</Button>
        <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={isPending}>Back</Button>
      </div>
    </form>
  );
}
