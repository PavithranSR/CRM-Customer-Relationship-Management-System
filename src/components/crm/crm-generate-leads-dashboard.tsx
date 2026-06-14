"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Globe2,
  MailCheck,
  PhoneCall,
  Sparkles,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { createCrmLead } from "@/actions/crm.actions";
import {
  GENERATE_LEAD_MODULES,
  getGenerateLeadModule,
  type GenerateLeadModuleKey,
} from "@/components/crm/generate-lead-modules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CrmGenerateLeadsDashboardProps {
  initialModule: GenerateLeadModuleKey;
  salesperson: {
    id: string;
    name: string;
    email: string;
  };
  clients: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }>;
}

type CreatedLeadState = {
  id: string;
  title: string;
  sourceType: string;
} | null;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

function getErrorMessage(error: unknown) {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    for (const value of Object.values(error as Record<string, unknown>)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  return "Something went wrong while creating the lead.";
}

export function CrmGenerateLeadsDashboard({
  initialModule,
  salesperson,
  clients,
}: CrmGenerateLeadsDashboardProps) {
  const router = useRouter();
  const workbenchRef = useRef<HTMLDivElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeModule, setActiveModule] = useState<GenerateLeadModuleKey>(initialModule);
  const [submittingModule, setSubmittingModule] = useState<GenerateLeadModuleKey | null>(null);
  const [lastCreatedLead, setLastCreatedLead] = useState<CreatedLeadState>(null);
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  const [companySearch, setCompanySearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(clients[0]?.id ?? null);

  const [mailPluginForm, setMailPluginForm] = useState({
    provider: "gmail",
    senderName: "",
    senderEmail: "",
    company: "",
    subject: "",
    message: "",
  });
  const [landingPageForm, setLandingPageForm] = useState({
    templateName: "",
    slug: "new-campaign",
    visitorName: "",
    visitorEmail: "",
    visitorPhone: "",
    company: "",
  });
  const [emailMarketingForm, setEmailMarketingForm] = useState({
    campaignName: "",
    contactListName: "",
    openRate: "",
    clickRate: "",
    replyName: "",
    replyEmail: "",
    company: "",
    replySummary: "",
  });
  const [appointmentForm, setAppointmentForm] = useState({
    meetingTitle: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    company: "",
    appointmentDate: "",
    appointmentTime: "",
  });
  const [surveyForm, setSurveyForm] = useState({
    surveyName: "",
    respondentName: "",
    respondentEmail: "",
    company: "",
    qualification: "high",
    responseSummary: "",
  });

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return clients.slice(0, 8);

    return clients
      .filter((client) =>
        [client.name, client.email, client.city || "", client.country || "", client.serviceName || "", client.projectName || ""]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .slice(0, 8);
  }, [clients, companySearch]);

  const selectedCompany = useMemo(
    () => clients.find((client) => client.id === selectedCompanyId) ?? null,
    [clients, selectedCompanyId],
  );

  const activeDefinition = getGenerateLeadModule(activeModule);
  const ActiveIcon = activeDefinition.icon;
  const landingPageUrl = `${origin || "https://crm.local"}/landing/${landingPageForm.slug || "new-campaign"}`;

  const selectModule = (moduleKey: GenerateLeadModuleKey) => {
    setActiveModule(moduleKey);
    router.replace(`/crm/generate-leads?module=${moduleKey}`, { scroll: false });
    requestAnimationFrame(() => {
      workbenchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submitLead = (
    moduleKey: GenerateLeadModuleKey,
    payload: {
      title: string;
      clientName?: string;
      email?: string;
      phone?: string;
      serviceName?: string;
      notes: string;
      leadSourceType: string;
      tags?: string;
      probabilityLevel?: number;
    },
    onSuccess?: () => void,
  ) => {
    startTransition(async () => {
      setSubmittingModule(moduleKey);

      const formData = new FormData();
      formData.set("title", payload.title);
      formData.set("clientName", payload.clientName || "");
      formData.set("email", payload.email || "");
      formData.set("phone", payload.phone || "");
      formData.set("serviceName", payload.serviceName || "");
      formData.set("notes", payload.notes);
      formData.set("stage", "new");
      formData.set("probabilityLevel", String(payload.probabilityLevel || 2));
      formData.set("leadSourceType", payload.leadSourceType);
      formData.set("ownerId", salesperson.id);
      formData.set(
        "tags",
        [payload.tags, `lead-source:${payload.leadSourceType}`].filter(Boolean).join(", "),
      );

      const result = await createCrmLead(formData);
      if (result.error) {
        toast.error(getErrorMessage(result.error));
        setSubmittingModule(null);
        return;
      }

      setLastCreatedLead({
        id: result.data?.id || "",
        title: payload.title,
        sourceType: payload.leadSourceType,
      });
      toast.success("Lead created and added to the CRM pipeline.");
      onSuccess?.();
      router.refresh();
      setSubmittingModule(null);
    });
  };

  const handleLeadSourcingSubmit = () => {
    if (!selectedCompany) {
      toast.error("Select a company before creating a lead.");
      return;
    }

    submitLead("lead-sourcing", {
      title: `${selectedCompany.name} Opportunity`,
      clientName: selectedCompany.name,
      email: selectedCompany.email,
      phone: selectedCompany.phone || "",
      serviceName: selectedCompany.serviceName || selectedCompany.projectName || "Lead Sourcing",
      notes: [
        "Lead generated from company database search.",
        `Company: ${selectedCompany.name}`,
        `Imported contact email: ${selectedCompany.email}`,
        `Imported contact phone: ${selectedCompany.phone || "-"}`,
        `Location: ${[selectedCompany.city, selectedCompany.country].filter(Boolean).join(", ") || "-"}`,
        `Assigned salesperson automatically: ${salesperson.name}`,
      ].join("\n"),
      leadSourceType: "lead_sourcing",
      tags: `company-db:${selectedCompany.name}`,
      probabilityLevel: 2,
    });
  };

  const handleMailPluginSubmit = () => {
    if (!mailPluginForm.senderName || !mailPluginForm.senderEmail || !mailPluginForm.subject) {
      toast.error("Sender name, sender email, and subject are required.");
      return;
    }

    submitLead(
      "mail-plugins",
      {
        title: `${mailPluginForm.senderName} - ${mailPluginForm.subject}`,
        clientName: mailPluginForm.company || mailPluginForm.senderName,
        email: mailPluginForm.senderEmail,
        serviceName: "Mail Plugin Lead",
        notes: [
          `Email provider: ${mailPluginForm.provider}`,
          `Sender: ${mailPluginForm.senderName}`,
          `Company: ${mailPluginForm.company || "-"}`,
          `Subject: ${mailPluginForm.subject}`,
          "Stored conversation:",
          mailPluginForm.message || "-",
        ].join("\n"),
        leadSourceType: "email",
        tags: `mail-provider:${mailPluginForm.provider}`,
        probabilityLevel: 2,
      },
      () =>
        setMailPluginForm({
          provider: "gmail",
          senderName: "",
          senderEmail: "",
          company: "",
          subject: "",
          message: "",
        }),
    );
  };

  const handleLandingPageSubmit = () => {
    if (!landingPageForm.templateName || !landingPageForm.visitorName || !landingPageForm.visitorEmail) {
      toast.error("Template, visitor name, and visitor email are required.");
      return;
    }

    submitLead(
      "landing-page",
      {
        title: `${landingPageForm.templateName} - ${landingPageForm.visitorName}`,
        clientName: landingPageForm.company || landingPageForm.visitorName,
        email: landingPageForm.visitorEmail,
        phone: landingPageForm.visitorPhone,
        serviceName: "Landing Page Lead",
        notes: [
          `Landing page template: ${landingPageForm.templateName}`,
          `Published URL: ${landingPageUrl}`,
          "Captured fields: name, email, phone, company",
        ].join("\n"),
        leadSourceType: "landing_page",
        tags: `landing-page:${landingPageForm.slug}`,
        probabilityLevel: 2,
      },
      () =>
        setLandingPageForm((current) => ({
          ...current,
          visitorName: "",
          visitorEmail: "",
          visitorPhone: "",
          company: "",
        })),
    );
  };

  const handleEmailMarketingSubmit = () => {
    if (!emailMarketingForm.campaignName || !emailMarketingForm.replyName || !emailMarketingForm.replyEmail) {
      toast.error("Campaign name, reply name, and reply email are required.");
      return;
    }

    submitLead(
      "email-marketing",
      {
        title: `${emailMarketingForm.campaignName} - ${emailMarketingForm.replyName}`,
        clientName: emailMarketingForm.company || emailMarketingForm.replyName,
        email: emailMarketingForm.replyEmail,
        serviceName: "Email Marketing Lead",
        notes: [
          `Campaign: ${emailMarketingForm.campaignName}`,
          `Contact list: ${emailMarketingForm.contactListName || "-"}`,
          `Open rate: ${emailMarketingForm.openRate || "0"}%`,
          `Click rate: ${emailMarketingForm.clickRate || "0"}%`,
          "Reply summary:",
          emailMarketingForm.replySummary || "-",
        ].join("\n"),
        leadSourceType: "email_marketing",
        tags: `campaign:${emailMarketingForm.campaignName}`,
        probabilityLevel: 2,
      },
      () =>
        setEmailMarketingForm({
          campaignName: "",
          contactListName: "",
          openRate: "",
          clickRate: "",
          replyName: "",
          replyEmail: "",
          company: "",
          replySummary: "",
        }),
    );
  };

  const handleAppointmentSubmit = () => {
    if (
      !appointmentForm.customerName ||
      !appointmentForm.customerEmail ||
      !appointmentForm.appointmentDate ||
      !appointmentForm.appointmentTime
    ) {
      toast.error("Customer name, email, date, and time are required.");
      return;
    }

    submitLead(
      "appointments",
      {
        title: appointmentForm.meetingTitle || `${appointmentForm.customerName} Meeting Request`,
        clientName: appointmentForm.company || appointmentForm.customerName,
        email: appointmentForm.customerEmail,
        phone: appointmentForm.customerPhone,
        serviceName: "Appointment Lead",
        notes: [
          `Meeting title: ${appointmentForm.meetingTitle || "Scheduled meeting"}`,
          `Booking date: ${appointmentForm.appointmentDate}`,
          `Booking time: ${appointmentForm.appointmentTime}`,
          `Company: ${appointmentForm.company || "-"}`,
        ].join("\n"),
        leadSourceType: "appointment",
        tags: "booking-calendar",
        probabilityLevel: 3,
      },
      () =>
        setAppointmentForm({
          meetingTitle: "",
          customerName: "",
          customerEmail: "",
          customerPhone: "",
          company: "",
          appointmentDate: "",
          appointmentTime: "",
        }),
    );
  };

  const handleSurveySubmit = () => {
    if (!surveyForm.respondentName || !surveyForm.respondentEmail || !surveyForm.surveyName) {
      toast.error("Survey name, respondent name, and respondent email are required.");
      return;
    }

    if (surveyForm.qualification === "low") {
      toast.info("This response was filtered out as unqualified, so no lead was created.");
      return;
    }

    submitLead(
      "survey",
      {
        title: `${surveyForm.surveyName} - ${surveyForm.respondentName}`,
        clientName: surveyForm.company || surveyForm.respondentName,
        email: surveyForm.respondentEmail,
        serviceName: "Survey Lead",
        notes: [
          `Survey: ${surveyForm.surveyName}`,
          `Qualification: ${surveyForm.qualification}`,
          "Response summary:",
          surveyForm.responseSummary || "-",
        ].join("\n"),
        leadSourceType: "survey",
        tags: `survey:${surveyForm.surveyName}`,
        probabilityLevel: surveyForm.qualification === "high" ? 3 : 2,
      },
      () =>
        setSurveyForm({
          surveyName: "",
          respondentName: "",
          respondentEmail: "",
          company: "",
          qualification: "high",
          responseSummary: "",
        }),
    );
  };

  const renderModuleForm = () => {
    switch (activeModule) {
      case "lead-sourcing":
        return (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company-search">Search companies from database</Label>
              <Input
                id="company-search"
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                placeholder="Search by company, email, location, or service"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">Matching companies</p>
                <div className="mt-3 space-y-2">
                  {filteredCompanies.length === 0 ? (
                    <p className="text-sm text-slate-500">No companies matched the current search.</p>
                  ) : (
                    filteredCompanies.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => setSelectedCompanyId(company.id)}
                        className={cn(
                          "flex w-full items-start justify-between rounded-xl border px-3 py-3 text-left transition",
                          selectedCompanyId === company.id
                            ? "border-slate-900 bg-white shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        <div>
                          <p className="font-medium text-slate-900">{company.name}</p>
                          <p className="text-sm text-slate-500">{company.email}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400" />
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Company details</p>
                {selectedCompany ? (
                  <div className="mt-3 space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{selectedCompany.name}</p>
                      <p className="text-slate-500">{selectedCompany.email}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
                        <p className="text-slate-700">{selectedCompany.phone || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Location</p>
                        <p className="text-slate-700">
                          {[selectedCompany.city, selectedCompany.country].filter(Boolean).join(", ") || "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Service</p>
                        <p className="text-slate-700">{selectedCompany.serviceName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">Project</p>
                        <p className="text-slate-700">{selectedCompany.projectName || "-"}</p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">
                      Contacts imported and ready. Salesperson auto-assigned to {salesperson.name}.
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Select a company to view details and import contacts.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleLeadSourcingSubmit}
                disabled={!selectedCompany || isPending}
                className="bg-[#44a2de] text-white hover:bg-[#3991ca]"
              >
                {isPending && submittingModule === "lead-sourcing" ? "Creating..." : "Create Lead from Selected Company"}
              </Button>
            </div>
          </div>
        );
      case "mail-plugins":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Email Provider</Label>
              <Select
                value={mailPluginForm.provider}
                onValueChange={(value) => setMailPluginForm((current) => ({ ...current, provider: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gmail">Gmail</SelectItem>
                  <SelectItem value="outlook">Outlook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
                value={mailPluginForm.senderName}
                onChange={(event) => setMailPluginForm((current) => ({ ...current, senderName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sender-email">Sender Email</Label>
              <Input
                id="sender-email"
                type="email"
                value={mailPluginForm.senderEmail}
                onChange={(event) => setMailPluginForm((current) => ({ ...current, senderEmail: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-company">Company</Label>
              <Input
                id="mail-company"
                value={mailPluginForm.company}
                onChange={(event) => setMailPluginForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mail-subject">Subject</Label>
              <Input
                id="mail-subject"
                value={mailPluginForm.subject}
                onChange={(event) => setMailPluginForm((current) => ({ ...current, subject: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="mail-message">Email Conversation</Label>
              <Textarea
                id="mail-message"
                rows={6}
                value={mailPluginForm.message}
                onChange={(event) => setMailPluginForm((current) => ({ ...current, message: event.target.value }))}
                placeholder="Paste the incoming customer email conversation here"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" onClick={handleMailPluginSubmit} disabled={isPending}>
                {isPending && submittingModule === "mail-plugins" ? "Creating..." : "Create Lead from Email"}
              </Button>
            </div>
          </div>
        );
      case "landing-page":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Landing Page Template</Label>
              <Input
                id="template-name"
                value={landingPageForm.templateName}
                onChange={(event) =>
                  setLandingPageForm((current) => ({
                    ...current,
                    templateName: event.target.value,
                    slug: slugify(event.target.value) || current.slug,
                  }))
                }
                placeholder="Spring campaign"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landing-slug">Published URL Slug</Label>
              <Input
                id="landing-slug"
                value={landingPageForm.slug}
                onChange={(event) =>
                  setLandingPageForm((current) => ({
                    ...current,
                    slug: slugify(event.target.value) || "new-campaign",
                  }))
                }
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
              Published URL: <span className="font-medium text-slate-900">{landingPageUrl}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 md:col-span-2">
              Contact fields included: <span className="font-medium text-slate-900">name, email, phone, company</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-name">Visitor Name</Label>
              <Input
                id="visitor-name"
                value={landingPageForm.visitorName}
                onChange={(event) => setLandingPageForm((current) => ({ ...current, visitorName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-email">Visitor Email</Label>
              <Input
                id="visitor-email"
                type="email"
                value={landingPageForm.visitorEmail}
                onChange={(event) => setLandingPageForm((current) => ({ ...current, visitorEmail: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-phone">Visitor Phone</Label>
              <Input
                id="visitor-phone"
                value={landingPageForm.visitorPhone}
                onChange={(event) => setLandingPageForm((current) => ({ ...current, visitorPhone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visitor-company">Company</Label>
              <Input
                id="visitor-company"
                value={landingPageForm.company}
                onChange={(event) => setLandingPageForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" onClick={handleLandingPageSubmit} disabled={isPending}>
                {isPending && submittingModule === "landing-page" ? "Creating..." : "Store Submission as Lead"}
              </Button>
            </div>
          </div>
        );
      case "email-marketing":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={emailMarketingForm.campaignName}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, campaignName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-list-name">Contact List</Label>
              <Input
                id="contact-list-name"
                value={emailMarketingForm.contactListName}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, contactListName: event.target.value }))}
                placeholder="Q2 prospects"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="open-rate">Open Rate %</Label>
              <Input
                id="open-rate"
                type="number"
                min="0"
                max="100"
                value={emailMarketingForm.openRate}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, openRate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="click-rate">Click Rate %</Label>
              <Input
                id="click-rate"
                type="number"
                min="0"
                max="100"
                value={emailMarketingForm.clickRate}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, clickRate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-name">Reply Contact Name</Label>
              <Input
                id="reply-name"
                value={emailMarketingForm.replyName}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, replyName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reply-email">Reply Contact Email</Label>
              <Input
                id="reply-email"
                type="email"
                value={emailMarketingForm.replyEmail}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, replyEmail: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="marketing-company">Company</Label>
              <Input
                id="marketing-company"
                value={emailMarketingForm.company}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reply-summary">Reply Summary</Label>
              <Textarea
                id="reply-summary"
                rows={5}
                value={emailMarketingForm.replySummary}
                onChange={(event) => setEmailMarketingForm((current) => ({ ...current, replySummary: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" onClick={handleEmailMarketingSubmit} disabled={isPending}>
                {isPending && submittingModule === "email-marketing" ? "Creating..." : "Convert Reply into Lead"}
              </Button>
            </div>
          </div>
        );
      case "appointments":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="meeting-title">Meeting Title</Label>
              <Input
                id="meeting-title"
                value={appointmentForm.meetingTitle}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, meetingTitle: event.target.value }))}
                placeholder="Discovery call"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                id="customer-name"
                value={appointmentForm.customerName}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, customerName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Customer Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={appointmentForm.customerEmail}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, customerEmail: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Customer Phone</Label>
              <Input
                id="customer-phone"
                value={appointmentForm.customerPhone}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, customerPhone: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-company">Company</Label>
              <Input
                id="appointment-company"
                value={appointmentForm.company}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-date">Booking Date</Label>
              <Input
                id="appointment-date"
                type="date"
                value={appointmentForm.appointmentDate}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, appointmentDate: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointment-time">Booking Time</Label>
              <Input
                id="appointment-time"
                type="time"
                value={appointmentForm.appointmentTime}
                onChange={(event) => setAppointmentForm((current) => ({ ...current, appointmentTime: event.target.value }))}
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" onClick={handleAppointmentSubmit} disabled={isPending}>
                {isPending && submittingModule === "appointments" ? "Creating..." : "Create Lead from Booking"}
              </Button>
            </div>
          </div>
        );
      case "survey":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="survey-name">Survey Form</Label>
              <Input
                id="survey-name"
                value={surveyForm.surveyName}
                onChange={(event) => setSurveyForm((current) => ({ ...current, surveyName: event.target.value }))}
                placeholder="Product-fit survey"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="respondent-name">Respondent Name</Label>
              <Input
                id="respondent-name"
                value={surveyForm.respondentName}
                onChange={(event) => setSurveyForm((current) => ({ ...current, respondentName: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="respondent-email">Respondent Email</Label>
              <Input
                id="respondent-email"
                type="email"
                value={surveyForm.respondentEmail}
                onChange={(event) => setSurveyForm((current) => ({ ...current, respondentEmail: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-company">Company</Label>
              <Input
                id="survey-company"
                value={surveyForm.company}
                onChange={(event) => setSurveyForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Qualification</Label>
              <Select
                value={surveyForm.qualification}
                onValueChange={(value) => setSurveyForm((current) => ({ ...current, qualification: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose qualification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High intent</SelectItem>
                  <SelectItem value="medium">Medium intent</SelectItem>
                  <SelectItem value="low">Low intent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="response-summary">Response Summary</Label>
              <Textarea
                id="response-summary"
                rows={5}
                value={surveyForm.responseSummary}
                onChange={(event) => setSurveyForm((current) => ({ ...current, responseSummary: event.target.value }))}
                placeholder="Summarize the survey answers and qualifying signals"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="button" onClick={handleSurveySubmit} disabled={isPending}>
                {isPending && submittingModule === "survey" ? "Creating..." : "Convert Qualified Response"}
              </Button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(241,245,249,0.88)_45%,_rgba(226,232,240,0.8)_100%)]">
        <CardContent className="grid gap-6 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
              <Sparkles className="h-3.5 w-3.5" />
              Generate Leads
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Lead Generation Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                One CRM workspace for lead sourcing, mail capture, landing pages, email campaigns, appointments,
                and surveys. Every module creates a real CRM lead with an automatic source tag and activity log.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Auto Assignment</p>
              <p className="mt-2 font-semibold text-slate-900">{salesperson.name}</p>
              <p className="text-sm text-slate-500">{salesperson.email}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Company Database</p>
              <p className="mt-2 font-semibold text-slate-900">{clients.length}</p>
              <p className="text-sm text-slate-500">Active companies ready for sourcing</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {lastCreatedLead ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Lead created from <span className="font-semibold">{lastCreatedLead.sourceType}</span>:{" "}
          <span className="font-semibold">{lastCreatedLead.title}</span>.{" "}
          {lastCreatedLead.id ? (
            <Link href={`/crm/${lastCreatedLead.id}`} className="font-semibold underline underline-offset-4">
              Open lead
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {GENERATE_LEAD_MODULES.map((module) => {
          const Icon = module.icon;
          const active = activeModule === module.key;

          return (
            <button
              key={module.key}
              type="button"
              onClick={() => selectModule(module.key)}
              className={cn(
                "group rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
                active && "border-slate-900 shadow-md",
              )}
            >
              <div className={cn("rounded-2xl bg-gradient-to-br p-5", module.accentClassName)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-3 text-slate-900 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-xs font-semibold uppercase tracking-[0.2em] text-slate-500", active && "text-slate-900")}>
                    Open
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-xl font-semibold text-slate-950">{module.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.shortDescription}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div ref={workbenchRef} className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-slate-950">
              <div className={cn("rounded-2xl bg-gradient-to-br p-3", activeDefinition.accentClassName)}>
                <ActiveIcon className="h-5 w-5 text-slate-900" />
              </div>
              <div>
                <div>{activeDefinition.title}</div>
                <CardDescription className="mt-1">{activeDefinition.purpose}</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">Module Purpose</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{activeDefinition.purpose}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Functions</p>
              <div className="space-y-2">
                {activeDefinition.functions.map((item) => (
                  <div key={item} className="flex items-start gap-2 rounded-xl border border-slate-200 px-3 py-2">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span className="text-sm text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Lead Source Type</p>
                <p className="mt-2 font-medium text-slate-900">{activeDefinition.key.replace(/-/g, "_")}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Assigned Salesperson</p>
                <p className="mt-2 font-medium text-slate-900">{salesperson.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-slate-950">Module Workspace</CardTitle>
            <CardDescription>
              Complete the module workflow below to create a CRM lead and log the creation event automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  CRM Leads DB
                </div>
                <p className="mt-2 text-sm text-slate-600">Every successful submission writes directly into the CRM leads table.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <MailCheck className="h-4 w-4 text-slate-500" />
                  Source Tracking
                </div>
                <p className="mt-2 text-sm text-slate-600">Each lead is tagged with its module source for reporting and workflow routing.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  <PhoneCall className="h-4 w-4 text-slate-500" />
                  Pipeline Logging
                </div>
                <p className="mt-2 text-sm text-slate-600">Lead creation is logged automatically so the pipeline keeps the source context.</p>
              </div>
            </div>

            {activeModule === "landing-page" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <Globe2 className="mr-2 inline h-4 w-4" />
                Publishing this module prepares a shareable landing URL and stores new submissions as CRM leads.
              </div>
            ) : null}

            {activeModule === "lead-sourcing" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <UserRound className="mr-2 inline h-4 w-4" />
                Company contacts are pulled from the active client database and assigned automatically to {salesperson.name}.
              </div>
            ) : null}

            {renderModuleForm()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
