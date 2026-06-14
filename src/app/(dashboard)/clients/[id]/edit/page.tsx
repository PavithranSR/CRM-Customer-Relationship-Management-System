import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientForm } from "@/components/clients/client-form";
import { fetchClientById, fetchStoredColleges } from "@/lib/client-read";

interface EditClientPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    collegeName?: string;
    courseName?: string;
    createCollege?: string;
  }>;
}

export default async function EditClientPage({ params, searchParams }: EditClientPageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");
  const canUpdate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("UPDATE") ||
    session.user.permissions.actionPermissions.includes("EDIT");

  if (!hasClientModuleAccess || !canUpdate) {
    redirect("/dashboard");
  }

  const client = await fetchClientById(id);
  if (!client) {
    notFound();
  }
  const colleges = await fetchStoredColleges();
  const paramsQuery = (await searchParams) ?? {};
  const draftValues = {
    collegeName: paramsQuery.collegeName || "",
    courseName: paramsQuery.courseName || "",
  };
  const hasDraftValues = Object.values(draftValues).some(Boolean);
  const openCreateCollege = paramsQuery.createCollege === "1";

  return (
    <ClientForm
      client={client}
      colleges={colleges}
      openCreateCollege={openCreateCollege}
      draftValues={hasDraftValues ? draftValues : undefined}
    />
  );
}
