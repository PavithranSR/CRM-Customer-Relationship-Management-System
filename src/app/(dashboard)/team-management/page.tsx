import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllTeams } from "@/lib/team-store.server";
import { getEmployees } from "@/actions/employee.actions";
import { TeamManagementShell } from "@/components/teams/team-management-shell";

export default async function TeamManagementPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employees = await getEmployees();
  const teams = await getAllTeams();

  return (
    <TeamManagementShell
      employees={employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
      }))}
      initialTeams={teams}
    />
  );
}

