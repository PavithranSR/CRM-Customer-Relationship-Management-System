import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { CrmGenerateLeadsDashboard } from "@/components/crm/crm-generate-leads-dashboard";
import {
  getGenerateLeadModule,
  type GenerateLeadModuleKey,
} from "@/components/crm/generate-lead-modules";

interface CrmGenerateLeadsPageProps {
  searchParams: Promise<{ module?: string }>;
}

export default async function CrmGenerateLeadsPage({ searchParams }: CrmGenerateLeadsPageProps) {
  const session = await auth();

  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeModule = getGenerateLeadModule(params.module).key as GenerateLeadModuleKey;

  const clients = await db.$queryRaw<
    Array<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      city: string | null;
      country: string | null;
      serviceName: string | null;
      projectName: string | null;
    }>
  >`
    SELECT
      "id",
      "name",
      "email",
      "phone",
      "city",
      "country",
      "serviceName",
      "projectName"
    FROM "clients"
    WHERE "isActive" = true
    ORDER BY "name" ASC
  `;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto">
      <CrmGenerateLeadsDashboard
        initialModule={activeModule}
        salesperson={{
          id: session.user.id || "",
          name: session.user.name || "Salesperson",
          email: session.user.email || "",
        }}
        clients={clients}
      />
    </div>
  );
}
