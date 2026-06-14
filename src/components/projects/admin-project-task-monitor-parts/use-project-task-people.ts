"use client";

import { useMemo } from "react";
import {
  isTaskAssignablePerson,
  type TeamPerson,
} from "@/components/projects/admin-project-task-monitor-parts/shared";

interface UseProjectTaskPeopleOptions {
  assignments: TeamPerson[];
  employees: TeamPerson[];
  projectTeamId?: string | null;
}

function sortTeamMembers(members: TeamPerson[]) {
  return [...members].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }

    return left.email.localeCompare(right.email);
  });
}

export function useProjectTaskPeople({ assignments, employees, projectTeamId }: UseProjectTaskPeopleOptions) {
  const projectTeamMembers = useMemo(() => {
    if (projectTeamId) {
      const directTeamMembers = employees.filter(
        (employee) => employee.role === "EMPLOYEE" && employee.teamId === projectTeamId
      );

      if (directTeamMembers.length > 0) {
        return sortTeamMembers(directTeamMembers);
      }
    }

    return [];
  }, [employees, projectTeamId]);

  const legacyStorageTeamMembers = useMemo(() => {
    if (typeof window === "undefined") {
      return [] as TeamPerson[];
    }

    try {
      const teamLeader = assignments.find((person) => person.role === "TEAMLEADER");
      if (!teamLeader) {
        return [] as TeamPerson[];
      }

      const raw = window.localStorage.getItem("team-management-data-v1");
      if (!raw) {
        return [] as TeamPerson[];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [] as TeamPerson[];
      }

      const targetTeam = parsed.find((team) => team.memberIds?.includes(teamLeader.id) || team.leadId === teamLeader.id);
      if (!targetTeam || !Array.isArray(targetTeam.memberIds)) {
        return [] as TeamPerson[];
      }

      return employees.filter((employee) => targetTeam.memberIds.includes(employee.id));
    } catch {
      return [] as TeamPerson[];
    }
  }, [assignments, employees]);

  const resolvedTeamMembers = useMemo(() => {
    if (projectTeamMembers.length > 0) {
      return projectTeamMembers;
    }

    const combined = [...assignments];
    legacyStorageTeamMembers.forEach((employee) => {
      if (!combined.find((person) => person.id === employee.id)) {
        combined.push(employee);
      }
    });

    return combined.filter((person) => isTaskAssignablePerson(person));
  }, [assignments, legacyStorageTeamMembers, projectTeamMembers]);

  const employeeAssignments = useMemo(() => sortTeamMembers(resolvedTeamMembers), [resolvedTeamMembers]);

  const projectAssignableIds = useMemo(
    () => new Set(employeeAssignments.map((person) => person.id)),
    [employeeAssignments]
  );

  const peopleMap = useMemo(
    () => new Map([...assignments, ...employees].map((person) => [person.id, person])),
    [assignments, employees]
  );

  return {
    employeeAssignments,
    peopleMap,
    projectAssignableIds,
    projectTeamMembers: employeeAssignments,
  };
}
