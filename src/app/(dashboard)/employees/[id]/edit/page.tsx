import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getEmployee,
  getEmployeeDepartmentOptions,
  getEmployeePositionOptionsByDepartment,
} from "@/actions/employee.actions";
import { EmployeeForm } from "@/components/employees/employee-form";

interface EditEmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employeePromise = getEmployee(id);
  const departmentOptions = await getEmployeeDepartmentOptions();
  const positionOptionsByDepartment = await getEmployeePositionOptionsByDepartment();
  const employee = await employeePromise;

  if (!employee) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Employee</h1>
        <p className="text-muted-foreground">Update employee information</p>
      </div>

      <EmployeeForm
        employee={employee}
        departmentOptions={departmentOptions}
        positionOptionsByDepartment={positionOptionsByDepartment}
      />
    </div>
  );
}

