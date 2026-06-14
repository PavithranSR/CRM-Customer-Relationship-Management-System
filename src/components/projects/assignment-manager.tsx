"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  assignEmployee,
  getAvailableEmployees,
  unassignEmployee,
} from "@/actions/assignment.actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, X } from "lucide-react";
import type { ProjectStatus, ProjectType, Role } from "@prisma/client";
import { toast } from "sonner";

interface Assignment {
  id: string;
  role: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

interface AvailableEmployee {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AssignmentManagerProps {
  projectId: string;
  projectName: string;
  projectStatus: ProjectStatus;
  projectType: ProjectType;
  assignments: Assignment[];
  canAssign: boolean;
}

type RoleFilter = "ALL" | "TEAMLEADER" | "EMPLOYEE";

export function AssignmentManager({
  projectId,
  projectName,
  projectStatus,
  projectType,
  assignments,
  canAssign,
}: AssignmentManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<AvailableEmployee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");

  const isCompleted = projectStatus === "COMPLETED";
  const canManageAssignments = canAssign && !isCompleted;

  const visibleAssignments = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.user.role === "TEAMLEADER" || assignment.user.role === "EMPLOYEE"
      ),
    [assignments]
  );

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return availableEmployees.filter((employee) => {
      const matchesRole = roleFilter === "ALL" || employee.role === roleFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        employee.name.toLowerCase().includes(normalizedSearch);

      return matchesRole && matchesSearch;
    });
  }, [availableEmployees, roleFilter, search]);

  useEffect(() => {
    if (!showAssignDialog) return;

    getAvailableEmployees(projectId).then((employees) => {
      setAvailableEmployees(employees);
    });
  }, [showAssignDialog, projectId]);

  const handleDialogToggle = (open: boolean) => {
    setShowAssignDialog(open);

    if (!open) {
      setSelectedEmployeeIds([]);
      setSearch("");
      setRoleFilter("ALL");
    }
  };

  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      if (checked) {
        return current.includes(employeeId) ? current : [...current, employeeId];
      }
      return current.filter((id) => id !== employeeId);
    });
  };

  const handleAssignSelected = () => {
    if (selectedEmployeeIds.length === 0) {
      toast.error("Select at least one employee");
      return;
    }

    startTransition(async () => {
      if (projectType === "INDIVIDUAL" && selectedEmployeeIds.length > 1) {
        toast.error("Individual projects allow only one assigned employee");
        return;
      }

      let assignedCount = 0;

      for (const userId of selectedEmployeeIds) {
        const formData = new FormData();
        formData.append("projectId", projectId);
        formData.append("userId", userId);

        const result = await assignEmployee(formData);

        if (result.error) {
          const errorMessage = typeof result.error === "string"
            ? result.error
            : Object.values(result.error).flat().join(", ");
          toast.error(errorMessage);
          return;
        }

        assignedCount += 1;
      }

      toast.success(
        assignedCount === 1 ? "1 employee assigned to project team" : `${assignedCount} employees assigned to project team`
      );
      handleDialogToggle(false);
    });
  };

  const handleUnassign = (assignmentId: string, employeeName: string) => {
    startTransition(async () => {
      const result = await unassignEmployee(assignmentId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${employeeName} removed from project team`);
    });
  };

  return (
    <div className="space-y-4">
      {visibleAssignments.length === 0 ? (
        <p className="text-muted-foreground">No team members assigned</p>
      ) : (
        <div className="space-y-3">
          {visibleAssignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-medium">
                  {assignment.user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{assignment.user.name}</p>
                  <p className="text-sm text-muted-foreground">{assignment.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {assignment.user.role === "TEAMLEADER" ? "TL" : "Employee"}
                </Badge>
                {canManageAssignments && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isPending}
                    onClick={() => handleUnassign(assignment.id, assignment.user.name)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAssignDialog} onOpenChange={handleDialogToggle}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={!canManageAssignments}>
            <Plus className="mr-2 h-4 w-4" />
            Assign Team Member
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Team Member</DialogTitle>
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employee-search">Search</Label>
                <Input
                  id="employee-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by employee name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-role-filter">Filter by role</Label>
                <Select
                  value={roleFilter}
                  onValueChange={(value) => setRoleFilter(value as RoleFilter)}
                >
                  <SelectTrigger id="employee-role-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="TEAMLEADER">Team Leader (TL)</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Team Leaders and Employees</Label>
              <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
                {filteredEmployees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No employees found</p>
                ) : (
                  filteredEmployees.map((employee) => {
                    const isSelected = selectedEmployeeIds.includes(employee.id);
                    return (
                      <label
                        key={employee.id}
                        className="flex cursor-pointer items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              toggleEmployeeSelection(employee.id, checked === true)
                            }
                          />
                          <div>
                            <p className="text-sm font-medium">{employee.name}</p>
                            <p className="text-xs text-muted-foreground">{employee.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {employee.role === "TEAMLEADER" ? "TL" : "Employee"}
                        </Badge>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogToggle(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignSelected}
              disabled={isPending || selectedEmployeeIds.length === 0}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {canAssign && isCompleted && (
        <p className="text-xs text-muted-foreground">
          Team assignment is locked because this project is completed.
        </p>
      )}
    </div>
  );
}
