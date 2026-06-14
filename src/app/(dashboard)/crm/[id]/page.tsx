import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArchivedCrmLeads, getCrmLead, getCrmLeadActivityLogs, getCrmStages, getDeletedCrmLeads } from "@/actions/crm.actions";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { CrmLeadChatter } from "@/components/crm/crm-lead-chatter";
import { CrmLeadRegister } from "@/components/crm/crm-lead-register";
import { CrmLeadQuickActions } from "@/components/crm/crm-lead-quick-actions";
import { CrmLeadStageStrip } from "@/components/crm/crm-lead-stage-strip";
import { CrmLeadArrowNav } from "@/components/crm/crm-lead-arrow-nav";
import { CrmQuotationNav } from "@/components/crm/crm-quotation-nav";
import Link from "next/link";
import { CalendarDays, CircleDollarSign, FileText, Settings, Star } from "lucide-react";

interface CrmLeadPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; label?: string; scope?: string; register?: string }>;
}

function getVisibleLeadTags(tags: string | null) {
  if (!tags) return "";
  const marker = "__client_meta__:";
  const markerIndex = tags.indexOf(marker);
  const userTags = markerIndex >= 0 ? tags.slice(0, markerIndex) : tags;
  return userTags.replace(/[,\s]+$/g, "").trim();
}

function normalizeStageMatch(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findStageKey(
  stages: Awaited<ReturnType<typeof getCrmStages>>,
  candidates: string[]
) {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeStageMatch(candidate);
    const matchedStage = stages.find((stage) => {
      const normalizedKey = normalizeStageMatch(stage.key);
      const normalizedLabel = normalizeStageMatch(stage.label);
      return (
        normalizedKey === normalizedCandidate ||
        normalizedLabel === normalizedCandidate ||
        normalizedKey.includes(normalizedCandidate) ||
        normalizedLabel.includes(normalizedCandidate)
      );
    });

    if (matchedStage) {
      return matchedStage.key;
    }
  }

  return null;
}

export default async function CrmLeadPage({ params, searchParams }: CrmLeadPageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  let stages: Awaited<ReturnType<typeof getCrmStages>> = [];
  let lead: Awaited<ReturnType<typeof getCrmLead>> = null;
  let clients: Array<{
    name: string;
    email: string;
    phone: string | null;
    street: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    country: string | null;
  }> = [];
  let quotationCount = 0;
  let confirmedOrdersTotal: number | null = null;
  let activityLogs: Awaited<ReturnType<typeof getCrmLeadActivityLogs>> = [];
  try {
    stages = await getCrmStages();
    lead = await getCrmLead(id);
    clients = await db.client.findMany({
      where: { isActive: true },
      select: {
        name: true,
        email: true,
        phone: true,
        street: true,
        address: true,
        city: true,
        state: true,
        zip: true,
        country: true,
      },
      orderBy: { name: "asc" },
    });
    quotationCount = await db.crmQuotation.count({
      where: { crmLeadId: id },
    });
    const confirmedOrdersAgg = await db.crmQuotation.aggregate({
      where: { crmLeadId: id, status: "SENT" },
      _sum: { totalAmount: true },
    });
    confirmedOrdersTotal = confirmedOrdersAgg._sum.totalAmount ?? null;
    activityLogs = await getCrmLeadActivityLogs(id, 30);
  } catch (error) {
    console.error("CRM lead page failed to load", error);
    return (
      <div className="rounded-md border bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">CRM is temporarily unavailable</h1>
        <p className="mt-2 text-sm">
          Could not connect to the database. Please check `DATABASE_URL` and Neon connectivity, then refresh.
        </p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/crm">Back to CRM</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (!lead) {
    notFound();
  }

  const backHref =
    typeof resolvedSearchParams.from === "string" && resolvedSearchParams.from.startsWith("/")
      ? resolvedSearchParams.from
      : "/crm";
  const scope =
    resolvedSearchParams.scope === "deleted" || resolvedSearchParams.scope === "archive"
      ? resolvedSearchParams.scope
      : null;

  const expectedRevenueValue = lead.value ?? 0;
  const expectedRevenue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(expectedRevenueValue);
  const hasSalesOrder = (confirmedOrdersTotal ?? 0) > 0;
  const orderAmountValue = confirmedOrdersTotal ?? 0;
  const orderAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(orderAmountValue);
  const probabilityLevel = Math.min(3, Math.max(1, lead.probabilityLevel ?? 1));
  const probabilityPercent = probabilityLevel === 1 ? 25 : probabilityLevel === 2 ? 50 : 75;
  const probabilityLabel = probabilityLevel === 1 ? "Low" : probabilityLevel === 2 ? "Medium" : "High";
  const visibleTags = getVisibleLeadTags(lead.tags);
  const leadHeaderTitle = lead.title || lead.clientName || "Opportunity";
  const leadFilterLabel = (lead.clientName || lead.title || "").trim();
  const registerTab = resolvedSearchParams.register === "extra" ? "extra" : "notes";
  const wonStageKey = findStageKey(stages, ["won", "completed", "complete", "closed won", "success", "done"]);
  const lostStageKey = findStageKey(stages, ["lost", "cancelled", "canceled", "closed lost", "rejected", "failed"]);
  const shouldHideArchived = session.user.role !== "ADMIN";
  const hiddenStageKeys = new Set(
    stages
      .filter((stage) => {
        if (!shouldHideArchived) return false;
        const normalized = stage.label.trim().toLowerCase();
        return normalized === "archived" || normalized === "deleted";
      })
      .map((stage) => stage.key)
  );
  const displayStages = stages.filter((stage) => !hiddenStageKeys.has(stage.key));
  const leadIds = scope === "deleted"
    ? (await getDeletedCrmLeads()).map((item) => item.id)
    : scope === "archive"
      ? (await getArchivedCrmLeads()).map((item) => item.id)
      : (
          await db.crmLead.findMany({
            where: shouldHideArchived ? { stage: { notIn: Array.from(hiddenStageKeys) } } : undefined,
            select: { id: true },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          })
        ).map((item) => item.id);
  const currentIndex = Math.max(0, leadIds.indexOf(lead.id));
  const totalCount = leadIds.length || 1;
  const currentCount = leadIds.length ? currentIndex + 1 : 1;
  const prevLeadId = currentIndex > 0 ? leadIds[currentIndex - 1] : null;
  const nextLeadId = currentIndex < leadIds.length - 1 ? leadIds[currentIndex + 1] : null;
  const navQuery = (() => {
    const query = new URLSearchParams();
    if (backHref) query.set("from", backHref);
    if (typeof resolvedSearchParams.label === "string" && resolvedSearchParams.label.trim()) {
      query.set("label", resolvedSearchParams.label.trim());
    }
    if (scope) query.set("scope", scope);
    const value = query.toString();
    return value ? `?${value}` : "";
  })();
  const enrichHref = (() => {
    const query = new URLSearchParams();
    if (backHref) query.set("from", backHref);
    if (typeof resolvedSearchParams.label === "string" && resolvedSearchParams.label.trim()) {
      query.set("label", resolvedSearchParams.label.trim());
    }
    if (scope) query.set("scope", scope);
    query.set("register", "extra");
    return `/crm/${lead.id}?${query.toString()}#crm-lead-register`;
  })();
  const serializedActivityLogs = activityLogs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    createdByName: log.createdBy?.name || null,
    metadata:
      log.metadata && typeof log.metadata === "object" && !Array.isArray(log.metadata)
        ? (log.metadata as Record<string, unknown>)
        : null,
  }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/30 shadow-sm">
        <div className="border-b border-slate-200/80 px-4 pt-3 pb-2">
          <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-2">
              <Button asChild variant="outline" size="sm" className="h-8 rounded-md px-3 text-sm">
                <Link href={`/crm/${lead.id}/quotations/new`}>New</Link>
              </Button>
              <div className="min-w-0 leading-tight">
                <p className="text-[11px] font-semibold leading-none text-cyan-700">Pipeline</p>
                <div className="mt-0.5 flex items-center gap-1">
                  <p className="truncate text-[17px] font-medium leading-tight text-slate-900 sm:text-[18px]">
                    {leadHeaderTitle}
                  </p>
                  <Settings className="h-3 w-3 shrink-0 text-slate-700" />
                </div>
              </div>
            </div>

            <div className="flex justify-start lg:justify-center">
              <div className="flex h-9 shrink-0 items-stretch overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="flex min-w-[118px] items-center gap-1.5 border-r border-slate-200 px-2.5">
                  <CalendarDays className="h-4 w-4 text-[#7c4a69]" />
                  <div className="flex flex-col justify-center leading-tight">
                    <p className="text-[13px] font-medium text-slate-900">No Meeting</p>
                  </div>
                </div>
                <div className="flex min-w-[104px] items-center gap-1.5 border-r border-slate-200 px-2.5">
                  <FileText className="h-4 w-4 text-[#7c4a69]" />
                  <div className="flex flex-col justify-center leading-tight">
                    <p className="text-[13px] font-medium text-slate-900">Quotations</p>
                    <p className="text-[13px] text-slate-600">{quotationCount}</p>
                  </div>
                </div>
                {hasSalesOrder ? (
                  <Link
                    href={`/crm/quotations?tab=orders&view=list&filterPreset=all_quotations&documentType=sales_orders&embedded=crm&leadId=${lead.id}${leadFilterLabel ? `&leadName=${encodeURIComponent(leadFilterLabel)}` : ""}`}
                    className="flex min-w-[116px] items-center gap-1.5 px-2.5 transition hover:bg-slate-50"
                  >
                    <CircleDollarSign className="h-4 w-4 text-[#7c4a69]" />
                    <div className="flex flex-col justify-center leading-tight">
                      <p className="text-[13px] font-medium text-slate-900">Orders</p>
                      <p className="text-[13px] text-slate-600">{orderAmount}</p>
                    </div>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-end">
              <CrmLeadArrowNav
                currentCount={currentCount}
                totalCount={totalCount}
                prevLeadId={prevLeadId}
                nextLeadId={nextLeadId}
                queryString={navQuery}
                compact
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-4">
            <div className="min-w-0">
              <div className="border-b border-slate-200/80 py-2.5">
                <div className="flex flex-col justify-between gap-3 pr-4 lg:flex-row lg:items-center">
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:flex-nowrap">
                    <CrmQuotationNav
                      leadId={lead.id}
                      backHref={backHref}
                      showBack={false}
                      newVariant="default"
                      newClassName="h-8 rounded-sm bg-[#7c4a69] px-3.5 text-sm font-semibold text-white shadow-none hover:bg-[#6d425d]"
                    />
                    <CrmLeadQuickActions
                      leadId={lead.id}
                      currentStage={lead.stage}
                      wonStageKey={wonStageKey}
                      lostStageKey={lostStageKey}
                      enrichHref={enrichHref}
                      isEnriching={registerTab === "extra"}
                      showEnrich={false}
                    />
                  </div>

                  <div className="min-w-0 lg:flex-1">
                    <div className="flex items-center justify-end overflow-x-auto pb-0.5">
                      <CrmLeadStageStrip
                        leadId={lead.id}
                        currentStage={lead.stage}
                        stages={displayStages}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-5 pt-4 pb-0">
                <div className="space-y-5">
                  <h1 className="text-[2.7rem] font-normal tracking-tight text-slate-900">{leadHeaderTitle}</h1>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-slate-500">Expected Revenue</p>
                      <p className="mt-1 text-[2.7rem] font-light text-slate-900">{expectedRevenue}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">Probability</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-[2.7rem] font-light text-slate-900">{probabilityPercent}%</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3].map((level) => (
                            <Star
                              key={level}
                              className={`h-5 w-5 ${level <= probabilityLevel ? "fill-amber-400 text-amber-500" : "text-slate-300"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-slate-600">{probabilityLabel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-7 text-sm sm:grid-cols-2">
                    <div className="space-y-3.5">
                      <div>
                        <p className="text-slate-500">Contact</p>
                        <p className="font-medium text-slate-900">{lead.clientName || "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Email</p>
                        <p className="font-medium text-slate-900">{lead.email || "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Phone</p>
                        <p className="font-medium text-slate-900">{lead.phone || "-"}</p>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <p className="text-slate-500">Salesperson</p>
                        <p className="font-medium text-slate-900">{session.user.name || "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Expected Closing</p>
                        <p className="font-medium text-slate-900">
                          {lead.expectedClosingDate ? new Date(lead.expectedClosingDate).toLocaleDateString() : "No closing estimate"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">Tags</p>
                        <p className="font-medium text-slate-900">{visibleTags || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-t-2xl border-t border-slate-200/80 bg-slate-50/70">
                <CrmLeadRegister lead={lead} clients={clients} initialTab={registerTab} backHref={backHref} />
              </div>
            </div>

            <div className="min-w-0 border-t border-slate-200/80 lg:min-h-full lg:border-t-0">
              <CrmLeadChatter
                leadId={lead.id}
                currentUserName={session.user.name || "User"}
                initialLogs={serializedActivityLogs}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
