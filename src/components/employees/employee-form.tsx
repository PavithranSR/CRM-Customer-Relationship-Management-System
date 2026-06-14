"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEmployee,
  createEmployeeDepartment,
  createEmployeePosition,
  updateEmployee,
} from "@/actions/employee.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@prisma/client";
import {
  ACTION_PERMISSION_OPTIONS,
  FIELD_LEVEL_PERMISSION_OPTIONS,
  MODULE_ACCESS_OPTIONS,
  RECORD_RULE_OPTIONS,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";
import {
  DEFAULT_EMPLOYEE_DEPARTMENTS,
  DEFAULT_POSITIONS_BY_DEPARTMENT,
} from "@/lib/employee-options";

const NONE_OPTION = "__none__";
const ADD_DEPARTMENT_OPTION = "__add_department__";
const ADD_POSITION_OPTION = "__add_position__";
const FIELD_PANEL_CLASS = "space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/40 p-2.5";
const PERMISSION_PANEL_CLASS = "self-start space-y-1.5 rounded-lg border border-slate-200 bg-white p-2.5";
const PERMISSION_OPTION_CLASS = "flex h-6 items-center gap-2 text-sm leading-none text-slate-700";

function mergeUniqueOptions(options: Array<string | null | undefined>) {
  const values = new Map<string, string>();

  for (const option of options) {
    const trimmed = option?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!values.has(key)) {
      values.set(key, trimmed);
    }
  }

  return Array.from(values.values());
}

function mergePositionOptionsByDepartment(
  options: Array<Record<string, string[]> | null | undefined>
) {
  const merged: Record<string, string[]> = {};

  for (const optionSet of options) {
    if (!optionSet) continue;

    for (const [department, positions] of Object.entries(optionSet)) {
      const trimmedDepartment = department.trim();
      if (!trimmedDepartment) continue;
      const existingDepartment =
        Object.keys(merged).find((key) => key.toLowerCase() === trimmedDepartment.toLowerCase()) ??
        trimmedDepartment;
      merged[existingDepartment] = mergeUniqueOptions([
        ...(merged[existingDepartment] ?? []),
        ...positions,
      ]);
    }
  }

  return merged;
}

function withPositionOption(
  optionsByDepartment: Record<string, string[]>,
  department: string,
  position: string
) {
  const existingDepartment =
    Object.keys(optionsByDepartment).find((key) => key.toLowerCase() === department.toLowerCase()) ??
    department;

  return {
    ...optionsByDepartment,
    [existingDepartment]: mergeUniqueOptions([
      ...(optionsByDepartment[existingDepartment] ?? []),
      position,
    ]),
  };
}

function getPositionOptionsForDepartment(
  optionsByDepartment: Record<string, string[]>,
  department: string
) {
  const key =
    Object.keys(optionsByDepartment).find((option) => option.toLowerCase() === department.toLowerCase()) ??
    department;

  return optionsByDepartment[key] ?? [];
}

interface EmployeeFormProps {
  departmentOptions?: string[];
  positionOptionsByDepartment?: Record<string, string[]>;
  employee?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    department: string | null;
    position: string | null;
    phone: string | null;
    hireDate: Date | null;
    isActive: boolean;
    permissions?: unknown;
  };
}

export function EmployeeForm({
  departmentOptions: savedDepartmentOptions = [],
  employee,
  positionOptionsByDepartment: savedPositionOptionsByDepartment = {},
}: EmployeeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isSavingDepartment, startDepartmentTransition] = useTransition();
  const [isSavingPosition, startPositionTransition] = useTransition();
  const router = useRouter();
  const isEditing = !!employee;
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(() => {
    return mergeUniqueOptions([
      ...savedDepartmentOptions,
      ...DEFAULT_EMPLOYEE_DEPARTMENTS,
      employee?.department,
    ]);
  });
  const [department, setDepartment] = useState(employee?.department ?? "");
  const [showAddDepartment, setShowAddDepartment] = useState(false);
  const [newDepartment, setNewDepartment] = useState("");
  const [positionOptionsByDepartment, setPositionOptionsByDepartment] = useState<
    Record<string, string[]>
  >(() => {
    const baseOptions = mergePositionOptionsByDepartment([
      DEFAULT_POSITIONS_BY_DEPARTMENT,
      savedPositionOptionsByDepartment,
    ]);

    if (!employee?.department || !employee?.position) {
      return baseOptions;
    }

    return withPositionOption(baseOptions, employee.department, employee.position);
  });
  const [position, setPosition] = useState(employee?.position ?? "");
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPosition, setNewPosition] = useState("");
  const [permissions, setPermissions] = useState(() =>
    normalizeEmployeePermissions(employee?.permissions, { enforceAccessWindow: false })
  );
  const [accessStartDate, setAccessStartDate] = useState(permissions.accessStartDate ?? "");
  const [accessEndDate, setAccessEndDate] = useState(permissions.accessEndDate ?? "");

  const positionOptions = department
    ? getPositionOptionsForDepartment(positionOptionsByDepartment, department)
    : [];

  async function handleSubmit(formData: FormData) {
    if (!isEditing) {
      const selectedDepartment = String(formData.get("department") ?? "").trim();
      const selectedPosition = String(formData.get("position") ?? "").trim();

      if (!selectedDepartment) {
        toast.error("Department is required");
        return;
      }

      if (!selectedPosition) {
        toast.error("Position is required");
        return;
      }
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateEmployee(employee.id, formData)
        : await createEmployee(formData);

      if (result.error) {
        const errorMessage = typeof result.error === "string"
          ? result.error
          : Object.values(result.error).flat().join(", ");
        toast.error(errorMessage);
      } else {
        toast.success(isEditing ? "Employee updated successfully" : "Employee created successfully");
        router.push("/employees");
      }
    });
  }

  function togglePermission(
    key: "moduleAccess" | "recordRules" | "actionPermissions" | "fieldLevelPermissions",
    value: string,
    checked: boolean
  ) {
    setPermissions((current) => {
      const selected = new Set(current[key]);
      if (checked) {
        selected.add(value as never);
      } else {
        selected.delete(value as never);
      }
      return {
        ...current,
        [key]: Array.from(selected),
      };
    });
  }

  const permissionLabels: Record<string, string> = {
    CRM: "CRM",
    PROJECT: "Project",
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

  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 !gap-0 !py-0 shadow-sm">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50 !px-4 !py-4 sm:!px-6 sm:!py-5">
        <CardTitle className="text-xl">{isEditing ? "Edit Employee" : "Create Employee"}</CardTitle>
        <CardDescription>
          Fill in account details and set user-based access permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="!px-4 !pb-4 !pt-3 sm:!px-5 sm:!pb-5 sm:!pt-4">
        <form action={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-x-4">
            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={employee?.name}
                required
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={employee?.email}
                required
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="password">
                {isEditing ? "Password (leave blank to keep current)" : "Password *"}
              </Label>
              <PasswordInput
                id="password"
                name="password"
                required={!isEditing}
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="role">Role *</Label>
              <Select name="role" defaultValue={employee?.role || "EMPLOYEE"}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {isEditing && employee?.role === "ADMIN" && (
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  )}
                  <SelectItem value="BA">BA</SelectItem>
                  <SelectItem value="TEAMLEADER">Team Leader</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="department">Department {!isEditing ? "*" : ""}</Label>
              <input type="hidden" name="department" value={department} />
              <Select
                value={department || NONE_OPTION}
                onValueChange={(value) => {
                  if (value === ADD_DEPARTMENT_OPTION) {
                    setShowAddDepartment(true);
                    return;
                  }
                  const nextDepartment = value === NONE_OPTION ? "" : value;
                  setDepartment(nextDepartment);
                  setShowAddDepartment(false);
                  setShowAddPosition(false);
                  setNewPosition("");
                  if (!nextDepartment) {
                    setPosition("");
                    return;
                  }
                  const nextOptions = getPositionOptionsForDepartment(
                    positionOptionsByDepartment,
                    nextDepartment
                  );
                  if (!nextOptions.some((option) => option.toLowerCase() === position.toLowerCase())) {
                    setPosition("");
                  }
                }}
              >
                <SelectTrigger id="department" disabled={isPending} className="bg-white">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>None</SelectItem>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_DEPARTMENT_OPTION}>+ Add department</SelectItem>
                </SelectContent>
              </Select>
              {showAddDepartment && (
                <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <Input
                    value={newDepartment}
                    onChange={(event) => setNewDepartment(event.target.value)}
                    placeholder="Type new department"
                    disabled={isPending || isSavingDepartment}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || isSavingDepartment}
                    onClick={() => {
                      const trimmed = newDepartment.trim();
                      if (!trimmed) {
                        toast.error("Department name is required");
                        return;
                      }

                      const existing = departmentOptions.find(
                        (option) => option.toLowerCase() === trimmed.toLowerCase()
                      );
                      if (existing) {
                        setDepartment(existing);
                        setShowAddDepartment(false);
                        setNewDepartment("");
                        return;
                      }

                      startDepartmentTransition(async () => {
                        const result = await createEmployeeDepartment(trimmed);

                        if (!result.success || !result.data) {
                          toast.error(result.error || "Unable to save department");
                          return;
                        }

                        const savedName = result.data.name;
                        setDepartmentOptions((current) => mergeUniqueOptions([...current, savedName]));
                        setPositionOptionsByDepartment((current) => ({
                          ...current,
                          [savedName]: current[savedName] ?? [],
                        }));
                        setDepartment(savedName);
                        setPosition("");
                        setShowAddDepartment(false);
                        setNewDepartment("");
                        toast.success("Department saved");
                        router.refresh();
                      });
                    }}
                  >
                    {isSavingDepartment ? "Saving..." : "Add"}
                  </Button>
                </div>
              )}
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="position">Position {!isEditing ? "*" : ""}</Label>
              <input type="hidden" name="position" value={position} />
              <Select
                value={position || NONE_OPTION}
                onValueChange={(value) => {
                  if (value === ADD_POSITION_OPTION) {
                    if (!department) {
                      toast.error("Select a department first");
                      return;
                    }
                    setShowAddPosition(true);
                    return;
                  }
                  setPosition(value === NONE_OPTION ? "" : value);
                  setShowAddPosition(false);
                }}
              >
                <SelectTrigger id="position" disabled={isPending} className="bg-white">
                  <SelectValue
                    placeholder={
                      department ? "Select position" : "Select department first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_OPTION}>None</SelectItem>
                  {positionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  <SelectItem value={ADD_POSITION_OPTION}>+ Add position</SelectItem>
                </SelectContent>
              </Select>
              {showAddPosition && (
                <div className="flex gap-2 rounded-lg border border-slate-200 bg-white p-2">
                  <Input
                    value={newPosition}
                    onChange={(event) => setNewPosition(event.target.value)}
                    placeholder="Type new position"
                    disabled={isPending || isSavingPosition}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending || isSavingPosition}
                    onClick={() => {
                      if (!department) {
                        toast.error("Select a department first");
                        return;
                      }

                      const trimmed = newPosition.trim();
                      if (!trimmed) {
                        toast.error("Position name is required");
                        return;
                      }

                      const existing = getPositionOptionsForDepartment(
                        positionOptionsByDepartment,
                        department
                      ).find((option) => option.toLowerCase() === trimmed.toLowerCase());

                      if (existing) {
                        setPosition(existing);
                        setShowAddPosition(false);
                        setNewPosition("");
                        return;
                      }

                      startPositionTransition(async () => {
                        const result = await createEmployeePosition(department, trimmed);

                        if (!result.success || !result.data) {
                          toast.error(result.error || "Unable to save position");
                          return;
                        }

                        const savedDepartment = result.data.departmentName;
                        const savedPosition = result.data.name;
                        setDepartmentOptions((current) => mergeUniqueOptions([...current, savedDepartment]));
                        setPositionOptionsByDepartment((current) =>
                          withPositionOption(current, savedDepartment, savedPosition)
                        );
                        setDepartment(savedDepartment);
                        setPosition(savedPosition);
                        setShowAddPosition(false);
                        setNewPosition("");
                        toast.success("Position saved");
                        router.refresh();
                      });
                    }}
                  >
                    {isSavingPosition ? "Saving..." : "Add"}
                  </Button>
                </div>
              )}
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={employee?.phone || ""}
                disabled={isPending}
                className="bg-white"
              />
            </div>

            <div className={FIELD_PANEL_CLASS}>
              <Label htmlFor="hireDate">Hire Date</Label>
              <Input
                id="hireDate"
                name="hireDate"
                type="date"
                defaultValue={employee?.hireDate ? new Date(employee.hireDate).toISOString().split("T")[0] : ""}
                disabled={isPending}
                className="bg-white"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/40 p-3">
            <h3 className="text-base font-semibold text-slate-900">Permission to Access</h3>
            <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 md:gap-x-3">
              <div className={PERMISSION_PANEL_CLASS}>
                <p className="text-sm font-semibold text-slate-700">Module Access</p>
                {MODULE_ACCESS_OPTIONS.map((option) => (
                  <label key={option} className={PERMISSION_OPTION_CLASS}>
                    <input
                      type="checkbox"
                      name="moduleAccess"
                      value={option}
                      checked={permissions.moduleAccess.includes(option)}
                      onChange={(event) =>
                        togglePermission("moduleAccess", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className={PERMISSION_PANEL_CLASS}>
                <p className="text-sm font-semibold text-slate-700">Record Rules</p>
                {RECORD_RULE_OPTIONS.map((option) => (
                  <label key={option} className={PERMISSION_OPTION_CLASS}>
                    <input
                      type="checkbox"
                      name="recordRules"
                      value={option}
                      checked={permissions.recordRules.includes(option)}
                      onChange={(event) =>
                        togglePermission("recordRules", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className={PERMISSION_PANEL_CLASS}>
                <p className="text-sm font-semibold text-slate-700">Action Permissions</p>
                {ACTION_PERMISSION_OPTIONS.map((option) => (
                  <label key={option} className={PERMISSION_OPTION_CLASS}>
                    <input
                      type="checkbox"
                      name="actionPermissions"
                      value={option}
                      checked={permissions.actionPermissions.includes(option)}
                      onChange={(event) =>
                        togglePermission("actionPermissions", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className={PERMISSION_PANEL_CLASS}>
                <p className="text-sm font-semibold text-slate-700">Field Level Permission</p>
                {FIELD_LEVEL_PERMISSION_OPTIONS.map((option) => (
                  <label key={option} className={PERMISSION_OPTION_CLASS}>
                    <input
                      type="checkbox"
                      name="fieldLevelPermissions"
                      value={option}
                      checked={permissions.fieldLevelPermissions.includes(option)}
                      onChange={(event) =>
                        togglePermission("fieldLevelPermissions", option, event.target.checked)
                      }
                      disabled={isPending}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                    />
                    <span>{permissionLabels[option]}</span>
                  </label>
                ))}
              </div>

              <div className={`${PERMISSION_PANEL_CLASS} md:col-span-2`}>
                <p className="text-sm font-semibold text-slate-700">Access Duration</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="accessStartDate">Start Date</Label>
                    <Input
                      id="accessStartDate"
                      name="accessStartDate"
                      type="date"
                      value={accessStartDate}
                      onChange={(event) => setAccessStartDate(event.target.value)}
                      disabled={isPending}
                      max={accessEndDate || undefined}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accessEndDate">End Date</Label>
                    <Input
                      id="accessEndDate"
                      name="accessEndDate"
                      type="date"
                      value={accessEndDate}
                      onChange={(event) => setAccessEndDate(event.target.value)}
                      disabled={isPending}
                      min={accessStartDate || undefined}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isEditing && (
            <input type="hidden" name="isActive" value={employee.isActive.toString()} />
          )}

          <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
              className="min-w-28"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-36">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Employee" : "Create Employee"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
