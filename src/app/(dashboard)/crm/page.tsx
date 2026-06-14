import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCrmLeads, getCrmStages } from "@/actions/crm.actions";
import { CrmPipelineView } from "@/components/crm/crm-pipeline-view";

interface CrmPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CrmPage({ searchParams }: CrmPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const query = params.q || "";
  let activeStages: Awaited<ReturnType<typeof getCrmStages>> = [];
  let activeLeads: Awaited<ReturnType<typeof getCrmLeads>>["leads"] = [];
  let queryValue = query;
  let clients: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    serviceName: string | null;
    projectName: string | null;
  }[] = [];

  try {
    const stages = await getCrmStages();
    const data = await getCrmLeads({ query });
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
    activeStages = shouldHideArchived
      ? stages.filter((stage) => !hiddenStageKeys.has(stage.key))
      : stages;
    activeLeads = shouldHideArchived
      ? data.leads.filter((lead) => !hiddenStageKeys.has(lead.stage))
      : data.leads;
    queryValue = data.query;
    clients = await db.$queryRaw<
      {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        city: string | null;
        state: string | null;
        country: string | null;
        serviceName: string | null;
        projectName: string | null;
      }[]
    >`
      SELECT
        "id",
        "name",
        "email",
        "phone",
        "city",
        "state",
        "country",
        "serviceName",
        "projectName"
      FROM "clients"
      WHERE "isActive" = true
      ORDER BY "name" ASC
    `;
  } catch (error) {
    console.error("CRM pipeline page failed to load", error);
    return (
      <div className="rounded-md border bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">CRM is temporarily unavailable</h1>
        <p className="mt-2 text-sm">
          Could not connect to the database. Please check `DATABASE_URL` and Neon connectivity, then refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <CrmPipelineView
          leads={activeLeads}
          stages={activeStages}
          query={queryValue}
          salesperson={{
            id: session.user.id || "",
            name: session.user.name || "Salesperson",
            email: session.user.email || "",
            role: session.user.role || "-",
          }}
          clients={clients}
        />
      </div>
    </div>
  );
}
