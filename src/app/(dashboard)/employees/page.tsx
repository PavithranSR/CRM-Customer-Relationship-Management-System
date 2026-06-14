import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployees, getEmployeeScheduledActivities } from "@/actions/employee.actions";
import { EmployeeTableShell } from "@/components/employees/employee-table-shell";

export default async function EmployeesPage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [employees, scheduledActivities] = await Promise.all([
    getEmployees(),
    getEmployeeScheduledActivities(),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <EmployeeTableShell employees={employees} initialScheduledActivities={scheduledActivities} />
      </div>
    </div>
  );
}

