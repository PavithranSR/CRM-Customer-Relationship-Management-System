import type { Role } from "@prisma/client";
import type { TeamListItem } from "@/lib/teams";
import { TeamManagement } from "@/components/teams/team-management";

interface TeamManagementShellProps {
  employees: {
    id: string;
    name: string;
    email: string;
    role: Role;
  }[];
  initialTeams: TeamListItem[];
}

export function TeamManagementShell(props: TeamManagementShellProps) {
  return <TeamManagement {...props} />;
}
