import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getEmployeeDepartmentOptions,
  getEmployeePositionOptionsByDepartment,
} from "@/actions/employee.actions";
import { EmployeeForm } from "@/components/employees/employee-form";

export default async function NewEmployeePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const departmentOptions = await getEmployeeDepartmentOptions();
  const positionOptionsByDepartment = await getEmployeePositionOptionsByDepartment();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-r from-white via-slate-50 to-slate-100/90 p-6 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Add Employee</h1>
      </div>

      <EmployeeForm
        departmentOptions={departmentOptions}
        positionOptionsByDepartment={positionOptionsByDepartment}
      />
    </div>
  );
}

