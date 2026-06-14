import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Clock3, Trash2 } from "lucide-react";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { CrmLeadArrowNav } from "@/components/crm/crm-lead-arrow-nav";
import { CrmPageShareDownload } from "@/components/crm/crm-page-share-download";
import { DeletedLeadDetailActions } from "@/components/crm/deleted-lead-detail-actions";
import { getDeletedCrmLeads } from "@/actions/crm.actions";

interface DeletedLeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeletedLeadDetailPage({ params }: DeletedLeadDetailPageProps) {
  const { id } = await params;
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  const deletedLeads = await getDeletedCrmLeads();
  const lead = deletedLeads.find((item) => item.id === id);

  if (!lead) {
    notFound();
  }

  const leadIndex = deletedLeads.findIndex((item) => item.id === id);
  const prevLeadId = leadIndex > 0 ? deletedLeads[leadIndex - 1]?.id ?? null : null;
  const nextLeadId = leadIndex < deletedLeads.length - 1 ? deletedLeads[leadIndex + 1]?.id ?? null : null;
  const deletedAt = "deletedAt" in lead && lead.deletedAt ? new Date(lead.deletedAt) : null;
  const previousStage = "previousStage" in lead ? lead.previousStage : null;
  const leadTitle = lead.title || lead.clientName || "Deleted lead";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-lg md:gap-8">
        <Link href="/crm/deleted" className="font-semibold text-slate-900 hover:underline">Back to Deleted Leads</Link>
        <Link href="/crm" className="text-slate-700 hover:underline">CRM</Link>
        <span className="text-slate-700">Deleted Detail</span>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
                <Trash2 className="h-4 w-4" />
                Deleted Lead
              </div>
              <h1 className="mt-3 truncate text-3xl font-semibold text-slate-900">{leadTitle}</h1>
              <p className="mt-2 text-sm text-slate-500">
                This is a deleted record detail page. It is separate from the normal CRM lead page.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" className="h-10 gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{deletedAt ? deletedAt.toLocaleDateString() : "No date"}</span>
              </Button>
              <CrmLeadArrowNav
                currentCount={leadIndex + 1}
                totalCount={deletedLeads.length}
                prevLeadId={prevLeadId}
                nextLeadId={nextLeadId}
                basePath="/crm/deleted"
              />
              <CrmPageShareDownload
                path={`/crm/deleted/${lead.id}`}
                shareTitle={leadTitle}
                displayMode="menu"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DeletedLeadDetailActions leadId={lead.id} />
          </div>
        </div>

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-xl border">
            <div className="grid gap-5 p-5 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Handled Person</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{lead.clientName || lead.title || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Email</p>
                  <p className="mt-1 font-medium text-slate-900 break-words">{lead.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Phone</p>
                  <p className="mt-1 font-medium text-slate-900">{lead.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Notes</p>
                  <p className="mt-1 min-h-16 rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {lead.notes || "No notes available."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">Current Stage</p>
                  <p className="mt-1 font-medium text-slate-900">Deleted</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Previous Stage</p>
                  <p className="mt-1 font-medium text-slate-900">{previousStage || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Deleted On</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {deletedAt ? deletedAt.toLocaleString() : "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Expected Revenue</p>
                  <p className="mt-1 font-medium text-slate-900">
                    {lead.value != null
                      ? new Intl.NumberFormat("en-IN", {
                          style: "currency",
                          currency: "INR",
                          minimumFractionDigits: 2,
                        }).format(lead.value)
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="self-start rounded-xl border p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Clock3 className="h-4 w-4" />
              <span className="text-sm font-medium">Record Timeline</span>
            </div>
            <div className="mt-4 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Created</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(lead.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Last Updated</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(lead.updatedAt).toLocaleString()}
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-red-50 p-4">
              <p className="text-xs text-red-500">Deleted Status</p>
              <p className="mt-1 text-sm font-medium text-red-700">
                This lead remains deleted until restored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
