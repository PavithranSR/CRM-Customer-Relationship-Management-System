import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCollegeDirectoryRows } from "@/actions/client.actions";
import { CollegeDirectoryPage } from "@/components/clients/college-directory-page";

export default async function CollegeDirectoryRoute() {
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

  const colleges = await getCollegeDirectoryRows();

  return <CollegeDirectoryPage colleges={colleges} />;
}
