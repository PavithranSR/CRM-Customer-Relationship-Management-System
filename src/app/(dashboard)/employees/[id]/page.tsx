import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployee } from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import {
  ACTION_PERMISSION_OPTIONS,
  FIELD_LEVEL_PERMISSION_OPTIONS,
  MODULE_ACCESS_OPTIONS,
  RECORD_RULE_OPTIONS,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";

interface EmployeePageProps {
  params: Promise<{ id: string }>;
}

export default async function EmployeePage({ params }: EmployeePageProps) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employee = await getEmployee(id);

  if (!employee) {
    notFound();
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-purple-500",
    BA: "bg-cyan-500",
    TEAMLEADER: "bg-blue-500",
    EMPLOYEE: "bg-gray-500",
  };
  const permissionLabels: Record<string, string> = {
    CRM: "CRM",
    PROJECT: "Projects",
    SALES: "Sales",
    OWN_RECORD: "Own Record",
    TEAM_RECORD: "Team Record",
    ASSIGN_PROJECT: "Assign Project",
    RECORD_RULES: "All Records",
    CREATE: "Create",
    EDIT: "Edit",
    DELETE: "Delete",
    UPDATE: "Update",
    BUDGET: "Budget",
    PROFIT: "Profit",
    DISCOUNT: "Discount",
  };
  const permissions = normalizeEmployeePermissions(employee.permissions);

  const renderPermissionGroup = (title: string, options: readonly string[], selected: readonly string[]) => (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No options configured</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const enabled = selected.includes(option);
            return (
              <Badge key={`${title}-${option}`} variant={enabled ? "default" : "outline"}>
                {permissionLabels[option] ?? option}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/employees">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{employee.name}</h1>
            <p className="text-muted-foreground">{employee.email}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/employees/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Employee Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge className={roleColors[employee.role]}>{employee.role}</Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={employee.isActive ? "default" : "secondary"}>
                  {employee.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Department</p>
                <p className="font-medium">{employee.department || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-medium">{employee.position || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{employee.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hire Date</p>
                <p className="font-medium">
                  {employee.hireDate
                    ? format(new Date(employee.hireDate), "MMM d, yyyy")
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Assignments</CardTitle>
            <CardDescription>Projects currently assigned to this employee</CardDescription>
          </CardHeader>
          <CardContent>
            {employee.assignments.length === 0 ? (
              <p className="text-muted-foreground">No active assignments</p>
            ) : (
              <div className="space-y-3">
                {employee.assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between">
                    <div>
                      <Link
                        href={`/projects/${assignment.project.id}`}
                        className="font-medium hover:underline"
                      >
                        {assignment.project.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{assignment.project.code}</p>
                    </div>
                    <Badge>{assignment.project.status.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Access Configuration</CardTitle>
            <CardDescription>
              Module access, record-level rules, action permissions, and field-level controls
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {renderPermissionGroup("Module Access", MODULE_ACCESS_OPTIONS, permissions.moduleAccess)}
            {renderPermissionGroup("Record Rules", RECORD_RULE_OPTIONS, permissions.recordRules)}
            {renderPermissionGroup(
              "Action Permissions",
              ACTION_PERMISSION_OPTIONS,
              permissions.actionPermissions
            )}
            {renderPermissionGroup(
              "Field Level Permissions",
              FIELD_LEVEL_PERMISSION_OPTIONS,
              permissions.fieldLevelPermissions
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent Time Entries</CardTitle>
            <CardDescription>Last 10 time entries logged</CardDescription>
          </CardHeader>
          <CardContent>
            {employee.timeEntries.length === 0 ? (
              <p className="text-muted-foreground">No time entries yet</p>
            ) : (
              <div className="space-y-3">
                {employee.timeEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{entry.project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(entry.date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{entry.hours}h</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.description?.substring(0, 50) || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

