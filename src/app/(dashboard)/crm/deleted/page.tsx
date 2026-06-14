import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDeletedCrmLeads } from "@/actions/crm.actions";
import { StoredLeadsBrowser } from "@/components/crm/stored-leads-browser";

export default async function CrmDeletedPage() {
  const session = await auth();
  if (
    !session?.user ||
    (session.user.role !== "ADMIN" && !session.user.moduleAccess.includes("CRM"))
  ) {
    redirect("/dashboard");
  }

  const deletedLeads = await getDeletedCrmLeads();

  return <StoredLeadsBrowser title="Deleted Leads" kind="deleted" leads={deletedLeads} />;
}
