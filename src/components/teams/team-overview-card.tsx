"use client";

import { useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { CalendarDays, ChevronDown, MoreHorizontal, PencilLine, Trash2, X } from "lucide-react";
import { formatTeamCreatedAt, type TeamListItem } from "@/lib/teams";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TeamOverviewCardProps {
  team: TeamListItem;
  viewMode?: "grid" | "list";
  isPending?: boolean;
  onEditTeam?: (team: TeamListItem) => void;
  onDeleteTeam?: (team: { teamId: string; teamName: string }) => void;
  onRemoveMember?: (member: { teamId: string; memberId: string; memberName: string }) => void;
}

const DEFAULT_VISIBLE_MEMBERS = 5;

function getInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatRoleLabel(role: Role) {
  switch (role) {
    case "TEAMLEADER":
      return "Team Leader";
    case "EMPLOYEE":
      return "Employee";
    case "BA":
      return "BA";
    case "ADMIN":
      return "Admin";
    default:
      return role;
  }
}

function formatListRoleLabel(role: Role) {
  switch (role) {
    case "TEAMLEADER":
      return "TL";
    case "BA":
      return "BA";
    case "ADMIN":
      return "Admin";
    default:
      return "Employee";
  }
}

function getRoleBadgeClass(role: Role) {
  switch (role) {
    case "TEAMLEADER":
      return "border-amber-200 bg-white text-amber-800";
    case "BA":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "ADMIN":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function TeamOverviewCard({
  team,
  viewMode = "grid",
  isPending = false,
  onEditTeam,
  onDeleteTeam,
  onRemoveMember,
}: TeamOverviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const sortedMembers = useMemo(
    () =>
      [...team.members].sort((a, b) => {
        const byLeadership = Number(b.role === "TEAMLEADER") - Number(a.role === "TEAMLEADER");
        if (byLeadership !== 0) {
          return byLeadership;
        }
        return a.name.localeCompare(b.name);
      }),
    [team.members]
  );
  const leaderCount = sortedMembers.filter((member) => member.role === "TEAMLEADER").length;
  const employeeCount = sortedMembers.filter((member) => member.role === "EMPLOYEE").length;
  const leadMember = sortedMembers.find((member) => member.role === "TEAMLEADER");
  const hasMoreMembers = sortedMembers.length > DEFAULT_VISIBLE_MEMBERS;
  const visibleMembers = showAllMembers
    ? sortedMembers
    : sortedMembers.slice(0, DEFAULT_VISIBLE_MEMBERS);
  const memberCountLabel = `${sortedMembers.length} ${sortedMembers.length === 1 ? "member" : "members"}`;

  const teamActions =
    onEditTeam || onDeleteTeam ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            disabled={isPending}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44 rounded-xl border-slate-200 bg-white p-1.5 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.32)]"
        >
          {onEditTeam ? (
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 text-sm text-slate-700"
              onClick={() => onEditTeam(team)}
            >
              <PencilLine className="h-4 w-4" />
              Edit Team
            </DropdownMenuItem>
          ) : null}
          {onDeleteTeam ? (
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 text-sm text-red-600 focus:bg-red-50 focus:text-red-700"
              onClick={() => onDeleteTeam({ teamId: team.id, teamName: team.name })}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
              Delete Team
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  if (viewMode === "list") {
    return (
      <div className="group relative w-full bg-white transition-colors duration-200">
        <div className="relative">
          <div className="flex items-center gap-2.5 px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${team.name}` : `Expand ${team.name}`}
              suppressHydrationWarning
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded((current) => !current)}
              className="min-w-0 flex-1 text-left"
              aria-expanded={isExpanded}
              suppressHydrationWarning
            >
              <span className="block truncate text-base font-semibold tracking-tight text-slate-950 sm:text-[17px]">
                {team.name}
              </span>
            </button>

            <Badge
              variant="outline"
              className="hidden shrink-0 rounded-full border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 sm:inline-flex"
            >
              {memberCountLabel}
            </Badge>

            {teamActions}
          </div>

          {isExpanded ? (
            <div className="border-t border-slate-200 bg-slate-50/40">
              {sortedMembers.length === 0 ? (
                <div className="px-6 py-4 text-sm text-slate-500">No team members yet.</div>
              ) : (
                <div>
                  {sortedMembers.map((member, memberIndex) => (
                    <div
                      key={member.id}
                      className={cn(
                        "grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto_auto] sm:items-center",
                        memberIndex > 0 && "border-t border-slate-200"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                        <span className="truncate text-base font-semibold text-slate-950">{member.name}</span>
                      </div>

                      <p className="truncate text-sm text-slate-600">{member.email}</p>

                      <Badge
                        variant="outline"
                        className={cn(
                          "w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                          getRoleBadgeClass(member.role)
                        )}
                      >
                        {formatListRoleLabel(member.role)}
                      </Badge>

                      {onRemoveMember ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="justify-self-start rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600 sm:justify-self-end"
                          onClick={() =>
                            onRemoveMember({
                              teamId: team.id,
                              memberId: member.id,
                              memberName: member.name,
                            })
                          }
                          disabled={isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <div className="hidden sm:block" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative self-start w-full overflow-hidden rounded-[20px] border border-border/80 bg-card/95 ring-1 ring-border/45 shadow-[0_20px_42px_-30px_rgba(15,23,42,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-[0_28px_52px_-30px_rgba(15,23,42,0.34)] dark:shadow-[0_28px_60px_-34px_rgba(2,6,23,0.88)]"
    >
      <div className="relative p-4">
        <div className="flex items-start justify-between gap-2.5">
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="min-w-0 flex-1 cursor-pointer text-left"
            aria-expanded={isExpanded}
            suppressHydrationWarning
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600">Team</p>
              <Badge
                variant="outline"
                className={cn(
                  "h-6 rounded-full px-2.5 text-[11px] font-semibold",
                  leadMember
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {leadMember ? "Leader Assigned" : "Needs Leader"}
              </Badge>
            </div>
            <p className="mt-2 truncate text-2xl font-semibold leading-none tracking-tight text-slate-950">
              {team.name}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-border/80 bg-background/90 px-3 py-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Members</p>
                <p className="mt-1.5 text-xl font-bold leading-none text-slate-950">{team.members.length}</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/90 px-3 py-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Leads</p>
                <p className="mt-1.5 text-xl font-bold leading-none text-slate-950">{leaderCount}</p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-background/90 px-3 py-3 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Employee</p>
                <p className="mt-1.5 text-xl font-bold leading-none text-slate-950">{employeeCount}</p>
              </div>
            </div>
          </button>

          <div className="flex shrink-0 flex-col items-end gap-3">
            {teamActions}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-1 text-[13px] font-semibold text-slate-700 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.35)]">
              <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
              {formatTeamCreatedAt(team.createdAt)}
            </span>
          </div>
        </div>

        {isExpanded ? (
          <div className="mt-2.5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Members</p>
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {sortedMembers.length} listed
              </Badge>
            </div>

            {sortedMembers.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-center text-sm text-slate-500">
                No team members yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {visibleMembers.map((member) => {
                  const isLeader = member.role === "TEAMLEADER";

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 transition-colors",
                        isLeader
                          ? "border-sky-200 bg-sky-50/70"
                          : "border-slate-200 bg-white"
                      )}
                    >
                      <Avatar className="size-9 rounded-lg border border-slate-200 bg-white shadow-sm">
                        <AvatarFallback
                          className={cn(
                            "rounded-lg text-sm font-semibold",
                            isLeader
                              ? "bg-sky-100 text-sky-700"
                              : "bg-slate-200 text-slate-700"
                          )}
                        >
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[15px] font-semibold leading-tight text-slate-900">{member.name}</p>
                        </div>
                        <p className="truncate text-[13px] text-slate-600">{member.email}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium",
                            getRoleBadgeClass(member.role)
                          )}
                        >
                          {formatRoleLabel(member.role)}
                        </Badge>

                        {onRemoveMember ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              onRemoveMember({
                                teamId: team.id,
                                memberId: member.id,
                                memberName: member.name,
                              })
                            }
                            disabled={isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {hasMoreMembers ? (
                  <div className="px-1 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      onClick={() => setShowAllMembers((current) => !current)}
                    >
                      {showAllMembers
                        ? "See less"
                        : `See more (${sortedMembers.length - DEFAULT_VISIBLE_MEMBERS} more)`}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
