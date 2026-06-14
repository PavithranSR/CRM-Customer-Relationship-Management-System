import type { Role } from "@prisma/client";

export interface TeamMemberListItem {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TeamListItem {
  id: string;
  name: string;
  createdAt: string;
  members: TeamMemberListItem[];
}

const teamDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatTeamCreatedAt(value: string) {
  return teamDateFormatter.format(new Date(value));
}
