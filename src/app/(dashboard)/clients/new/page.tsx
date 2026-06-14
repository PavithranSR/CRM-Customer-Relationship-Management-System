import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ClientForm } from "@/components/clients/client-form";
import { fetchStoredColleges } from "@/lib/client-read";

interface NewClientPageProps {
  searchParams?: Promise<{
    name?: string;
    email?: string;
    phone?: string;
    collegeName?: string;
    courseName?: string;
    createCollege?: string;
  }>;
}

export default async function NewClientPage({ searchParams }: NewClientPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/dashboard");
  }

  const hasClientModuleAccess =
    session.user.role === "ADMIN" ||
    session.user.permissions.moduleAccess.includes("CRM");
  const canCreate =
    session.user.role === "ADMIN" ||
    session.user.permissions.actionPermissions.includes("CREATE");

  if (!hasClientModuleAccess || !canCreate) {
    redirect("/dashboard");
  }
  const colleges = await fetchStoredColleges();
  const params = (await searchParams) ?? {};
  const draftValues = {
    name: params.name || "",
    email: params.email || "",
    phone: params.phone || "",
    collegeName: params.collegeName || "",
    courseName: params.courseName || "",
  };
  const hasDraftValues = Object.values(draftValues).some(Boolean);
  const openCreateCollege = params.createCollege === "1";

  return (
    <ClientForm
      colleges={colleges}
      openCreateCollege={openCreateCollege}
      draftValues={hasDraftValues ? draftValues : undefined}
    />
  );
}
