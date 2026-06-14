"use client";

import { useMemo } from "react";

interface ProfileDetailsProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    department: string | null;
    position: string | null;
  };
  teamName: string;
  assignedProjects: {
    id: string;
    name: string;
  }[];
  reportingTo: string[];
}

function formatRoleLabel(role: string) {
  switch (role) {
    case "TEAMLEADER":
      return "Team Leader";
    case "EMPLOYEE":
      return "Employee";
    case "ADMIN":
      return "Admin";
    case "BA":
      return "BA";
    default:
      return role;
  }
}

export function ProfileDetails({
  user,
  teamName,
  assignedProjects,
  reportingTo,
}: ProfileDetailsProps) {
  const reportingLabel = useMemo(() => {
    if (reportingTo.length > 0) {
      return reportingTo.join(", ");
    }
    if (user.role === "BA") {
      return "Admin";
    }
    return "-";
  }, [reportingTo, user.role]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Personal details and current project assignment summary
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="space-y-4 text-base">
          <p>
            <span className="font-semibold">Name:</span> {user.name}
          </p>
          <p>
            <span className="font-semibold">Email:</span> {user.email}
          </p>
          <p>
            <span className="font-semibold">Phone:</span> {user.phone || "-"}
          </p>
        </div>

        <div className="mt-6 space-y-4 text-base">
          <p>
            <span className="font-semibold">Role:</span> {formatRoleLabel(user.role)}
          </p>
          <p>
            <span className="font-semibold">Department:</span> {user.department || "-"}
          </p>
          <p>
            <span className="font-semibold">Position:</span> {user.position || "-"}
          </p>
        </div>

        <div className="mt-6 space-y-4 text-base">
          <p>
            <span className="font-semibold">Team:</span> {teamName}
          </p>
          <p>
            <span className="font-semibold">Reporting To:</span> {reportingLabel}
          </p>
        </div>

        <div className="mt-6 text-base">
          <p className="font-semibold">Assigned Projects:</p>
          {assignedProjects.length > 0 ? (
            <div className="mt-3 space-y-2">
              {assignedProjects.map((project) => (
                <p key={project.id}>- {project.name}</p>
              ))}
            </div>
          ) : (
            <p className="mt-3">- None</p>
          )}
        </div>
      </div>
    </div>
  );
}
