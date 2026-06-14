"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getEmployeeOptionLabel, type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";

interface EmployeeAssigneeInputProps {
  projectId: string;
  employees: TeamPerson[];
  value: string;
  onValueChange: (value: string) => void;
  onEmployeePick: (employee: TeamPerson) => void;
  onClearSelection?: () => void;
  placeholder: string;
  disabled?: boolean;
  inputId?: string;
  className?: string;
}

export function EmployeeAssigneeInput({
  projectId,
  employees,
  value,
  onValueChange,
  onEmployeePick,
  onClearSelection,
  placeholder,
  disabled = false,
  inputId,
  className,
}: EmployeeAssigneeInputProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showSearchMore, setShowSearchMore] = useState(false);
  const pickerKey = inputId ? `project-team-member-picker:${inputId}` : null;

  const filteredEmployees = useMemo(() => {
    const query = value.trim().toLowerCase();

    if (!query) {
      return employees;
    }

    return employees.filter((employee) => {
      const label = getEmployeeOptionLabel(employee).toLowerCase();
      return (
        label.includes(query) ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query)
      );
    });
  }, [employees, value]);

  const visibleEmployees = filteredEmployees.slice(0, 4);
  const hasEmployees = filteredEmployees.length > 0;

  const handleSelectEmployee = (employee: TeamPerson) => {
    onEmployeePick(employee);
    setIsOpen(false);
  };

  const handleClearSelection = () => {
    onClearSelection?.();
    onValueChange("");
    setIsOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !pickerKey) {
      return;
    }

    const consumeSelection = () => {
      const raw = window.localStorage.getItem(pickerKey);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<TeamPerson> | null;
        if (!parsed || typeof parsed.id !== "string" || typeof parsed.name !== "string" || typeof parsed.email !== "string") {
          return;
        }

        const selectedEmployee: TeamPerson = {
          id: parsed.id,
          name: parsed.name,
          email: parsed.email,
          role: typeof parsed.role === "string" ? parsed.role : "EMPLOYEE",
          teamId: typeof parsed.teamId === "string" ? parsed.teamId : null,
          department: typeof parsed.department === "string" ? parsed.department : null,
          position: typeof parsed.position === "string" ? parsed.position : null,
          phone: typeof parsed.phone === "string" ? parsed.phone : null,
          hireDate: typeof parsed.hireDate === "string" ? parsed.hireDate : null,
          isActive: typeof parsed.isActive === "boolean" ? parsed.isActive : true,
        };

        onValueChange(getEmployeeOptionLabel(selectedEmployee));
        onEmployeePick(selectedEmployee);
        window.localStorage.removeItem(pickerKey);
      } catch {
        window.localStorage.removeItem(pickerKey);
      }
    };

    consumeSelection();
    window.addEventListener("focus", consumeSelection);
    window.addEventListener("storage", consumeSelection);

    return () => {
      window.removeEventListener("focus", consumeSelection);
      window.removeEventListener("storage", consumeSelection);
    };
  }, [onEmployeePick, onValueChange, pickerKey]);

  const openTeamMembersPage = () => {
    if (!pickerKey) return;

    const returnHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const params = new URLSearchParams({
      pickerKey,
      returnHref,
    });

    setShowSearchMore(false);
    setIsOpen(false);
    router.push(`/projects/${projectId}/team-members?${params.toString()}`);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Popover open={disabled ? false : isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
          <Input
            id={inputId}
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
                setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={`rounded-none border-0 border-b border-slate-200 px-0 shadow-none focus-visible:ring-0 ${className ?? ""}`}
          />
        </PopoverTrigger>
          <PopoverContent align="start" sideOffset={6} className="w-[var(--radix-popover-trigger-width)] p-1">
            <div className="max-h-60 overflow-y-auto">
              {visibleEmployees.length > 0 ? (
                visibleEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-slate-900 hover:bg-slate-100"
                    onClick={() => handleSelectEmployee(employee)}
                  >
                    {getEmployeeOptionLabel(employee)}
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-slate-500">No employee found</p>
              )}
            </div>

            {hasEmployees ? (
              <div className="mt-1 border-t border-slate-200 pt-1">
                <button
                  type="button"
                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-semibold text-cyan-700 hover:bg-cyan-50"
                  onClick={() => {
                    setShowSearchMore(true);
                    setIsOpen(false);
                  }}
                >
                  See More
                </button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>

        {value.trim() ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleClearSelection}
            disabled={disabled}
            className="shrink-0"
            aria-label="Clear assignee"
            title="Clear assignee"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <Dialog open={showSearchMore} onOpenChange={setShowSearchMore}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="sr-only">
            <DialogTitle>Open Team Members</DialogTitle>
            <DialogDescription>Open the team members page to search and select an employee.</DialogDescription>
          </DialogHeader>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Open Team Members</CardTitle>
              <CardDescription>
                Use the full searchable team directory to find employees more easily.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                The team members page includes search, filters, and one-click selection.
              </div>
              <div className="flex gap-2">
                <Button type="button" className="flex-1 bg-[#44a2de] text-white hover:bg-[#3991ca]" onClick={openTeamMembersPage}>
                  Open Team Members
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowSearchMore(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </>
  );
}
