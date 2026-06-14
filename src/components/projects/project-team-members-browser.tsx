"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getEmployeeAvatarLetter, type TeamPerson } from "@/components/projects/admin-project-task-monitor-parts/shared";

type TeamMemberItem = TeamPerson & {
  activeTasks: number;
  completedTasks: number;
  currentStatus: string;
};

interface ProjectTeamMembersBrowserProps {
  members: TeamMemberItem[];
  pickerKey: string | null;
  projectId: string;
  projectName: string;
  returnHref: string;
}

type RoleFilter = "all" | "TEAMLEADER" | "EMPLOYEE" | "BA";
type StatusFilter = "all" | "active" | "inactive";

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function ProjectTeamMembersBrowser({
  members,
  pickerKey,
  projectId,
  projectName,
  returnHref,
}: ProjectTeamMembersBrowserProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredMembers = useMemo(() => {
    const query = normalizeQuery(search);

    return members.filter((member) => {
      const matchesSearch =
        !query ||
        [member.name, member.email, member.department ?? "", member.position ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesRole = roleFilter === "all" || member.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? member.isActive !== false : member.isActive === false);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [members, roleFilter, search, statusFilter]);

  const activeCount = members.filter((member) => member.isActive !== false).length;
  const inactiveCount = members.length - activeCount;

  const handleSelect = (member: TeamMemberItem) => {
    if (typeof window === "undefined") {
      return;
    }

    const selectionKey = pickerKey ?? `project-team-member-picker:${projectId}:browser`;
    window.localStorage.setItem(
      selectionKey,
      JSON.stringify({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        teamId: member.teamId,
        department: member.department,
        position: member.position,
        phone: member.phone,
        hireDate: member.hireDate,
        isActive: member.isActive,
      })
    );
    router.push(returnHref);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50/60 p-6 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Team Members</p>
            <h1 className="text-3xl font-light tracking-tight text-slate-950">{projectName}</h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Search the full project team and select an employee to return to the task assignment field.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-cyan-200 bg-cyan-50 px-3 py-1 text-cyan-700">
              {members.length} members
            </Badge>
            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              {activeCount} active
            </Badge>
            <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-700">
              {inactiveCount} inactive
            </Badge>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, department, or position"
              className="border-slate-200"
            />
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="TEAMLEADER">Team Leader</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="BA">BA</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="border-slate-200">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription>
            {filteredMembers.length} of {members.length} team members shown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No team members match your filters.</p>
              <p className="mt-1 text-sm text-slate-500">Try clearing the search or switching to another role.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.25)] sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#44a2de] text-lg font-semibold text-white">
                      {getEmployeeAvatarLetter(member.name)}
                      <span
                        className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ${
                          member.isActive === false ? "bg-slate-300" : "bg-emerald-500"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{member.name}</p>
                      <p className="truncate text-sm text-slate-500">{member.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-slate-700">
                          {member.role}
                        </Badge>
                        {member.department ? (
                          <Badge variant="outline" className="rounded-full border-cyan-200 bg-cyan-50 text-cyan-700">
                            {member.department}
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={`rounded-full ${
                            member.isActive === false
                              ? "border-slate-200 bg-slate-100 text-slate-500"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {member.isActive === false ? "Inactive" : "Active"}
                        </Badge>
                        <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">
                          {member.currentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <span className="font-semibold text-slate-900">{member.activeTasks}</span> active tasks
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="font-semibold text-slate-900">{member.completedTasks}</span> completed
                    </div>
                    <Button
                      type="button"
                      className="bg-[#44a2de] text-white hover:bg-[#3991ca]"
                      onClick={() => handleSelect(member)}
                    >
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
