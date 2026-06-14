import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getArchivedCrmLeads } from "@/actions/crm.actions";
import { StoredLeadsBrowser } from "@/components/crm/stored-leads-browser";

export default async function CrmArchivePage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  const archivedLeads = await getArchivedCrmLeads();

  return <StoredLeadsBrowser title="Archived Leads" kind="archive" leads={archivedLeads} />;
}
