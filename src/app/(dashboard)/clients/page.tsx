import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getClients, type ClientStatusFilter } from "@/actions/client.actions";
import { ClientTable } from "@/components/clients/client-table";
import { auth } from "@/lib/auth";

interface ClientsPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    collegeName?: string;
    courseName?: string;
    country?: string;
    state?: string;
    city?: string;
    serviceName?: string;
    projectName?: string;
    tags?: string;
  }>;
}

const CLIENTS_PAGE_HEIGHT_CLASS =
  "h-[calc(100dvh-5.5rem)] sm:h-[calc(100dvh-6rem)] md:h-[calc(100dvh-6.5rem)]";
const CLIENTS_PAGE_BOTTOM_OFFSET_CLASS = "-mb-4 sm:-mb-5";

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");

  if (!hasClientModuleAccess) {
    redirect("/dashboard");
  }

  const canCreate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("CREATE");
  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");
  const canDelete =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("DELETE");

  const params = await searchParams;
  const query = params.q || "";
  const page = Math.max(1, Number(params.page || 1) || 1);
  const rawStatus = params.status;
  const status: ClientStatusFilter =
    rawStatus === "active" ? "active" : rawStatus === "inactive" ? "inactive" : "all";
  const filters = {
    collegeName: params.collegeName || "",
    courseName: params.courseName || "",
    country: params.country || "",
    state: params.state || "",
    city: params.city || "",
    serviceName: params.serviceName || "",
    projectName: params.projectName || "",
    tags: params.tags || "",
  };
  const data = await getClients({ query, page, pageSize: 10, status, ...filters });

  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-4 overflow-hidden ${CLIENTS_PAGE_HEIGHT_CLASS} ${CLIENTS_PAGE_BOTTOM_OFFSET_CLASS}`}
    >
      <Suspense fallback={<div className="flex min-h-0 flex-1 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading contacts...</div>}>
        <ClientTable
          clients={data.clients}
          page={data.page}
          pages={data.pages}
          query={data.query}
          filters={filters}
          status={status}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      </Suspense>
    </div>
  );
}
