"use server";

import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getAllTeams, getTeamById } from "@/lib/team-store.server";
import { logActivity } from "./activity-log.actions";
import {
  findTeamNameByName,
  getSelectedUsers,
  normalizeLegacyTeams,
  normalizeMemberIds,
  revalidateTeamPaths,
  type LegacyTeamInput,
  type TeamMemberRow,
  type TeamNameRow,
} from "./team-action-helpers";

export async function createTeam(input: { name: string; memberIds: string[] }) {
  const admin = await requireAdmin();
  const trimmedName = input.name.trim();
  const memberIds = normalizeMemberIds(input.memberIds);

  if (!trimmedName) {
    return { error: "Team name is required" };
  }

  if (memberIds.length === 0) {
    return { error: "Select at least 1 employee" };
  }

  const existingTeam = await findTeamNameByName(trimmedName);
  if (existingTeam) {
    return { error: "Team name already exists" };
  }

  const selectedUsers = await getSelectedUsers(memberIds);

  if (selectedUsers.length !== memberIds.length) {
    return { error: "Some selected employees could not be found" };
  }

  const adminSelection = selectedUsers.find((user) => user.role === "ADMIN");
  if (adminSelection) {
    return { error: "Admin cannot be added to a team" };
  }

  const assignedUser = selectedUsers.find((user) => user.teamId);
  if (assignedUser) {
    return { error: `${assignedUser.name} is already assigned to another team` };
  }

  const teamId = randomUUID();

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "teams" ("id", "name", "createdAt", "updatedAt")
        VALUES (${teamId}, ${trimmedName}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      const assignedRows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "users"
        SET
          "teamId" = ${teamId},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "id" IN (${Prisma.join(memberIds)})
          AND "role" <> 'ADMIN'
          AND "teamId" IS NULL
        RETURNING "id"
      `;

      if (assignedRows.length !== memberIds.length) {
        throw new Error("TEAM_MEMBER_ASSIGNMENT_FAILED");
      }
    });

    const team = await getTeamById(teamId);

    if (!team) {
      return { error: "Team was created but could not be loaded" };
    }

    await logActivity({
      action: "CREATE",
      entityType: "team",
      entityId: team.id,
      createdById: admin.id,
      metadata: {
        teamName: team.name,
        memberCount: team.members.length,
      },
    });

    revalidateTeamPaths();
    return { success: true as const, data: team };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Team name already exists" };
    }

    if (error instanceof Error && error.message === "TEAM_MEMBER_ASSIGNMENT_FAILED") {
      return { error: "One or more selected employees were already assigned to another team" };
    }

    throw error;
  }
}

export async function updateTeam(input: { teamId: string; name: string; memberIds: string[] }) {
  const admin = await requireAdmin();
  const normalizedTeamId = input.teamId.trim();
  const trimmedName = input.name.trim();
  const memberIds = normalizeMemberIds(input.memberIds);

  if (!normalizedTeamId) {
    return { error: "Team not found" };
  }

  if (!trimmedName) {
    return { error: "Team name is required" };
  }

  if (memberIds.length === 0) {
    return { error: "Select at least 1 employee" };
  }

  const existingTeam = await getTeamById(normalizedTeamId);

  if (!existingTeam) {
    return { error: "Team not found" };
  }

  const duplicateTeamRows = await db.$queryRaw<TeamNameRow[]>`
    SELECT "id"
    FROM "teams"
    WHERE LOWER("name") = LOWER(${trimmedName})
      AND "id" <> ${normalizedTeamId}
    LIMIT 1
  `;

  if (duplicateTeamRows[0]) {
    return { error: "Team name already exists" };
  }

  const selectedUsers = await getSelectedUsers(memberIds);

  if (selectedUsers.length !== memberIds.length) {
    return { error: "Some selected employees could not be found" };
  }

  const adminSelection = selectedUsers.find((user) => user.role === "ADMIN");
  if (adminSelection) {
    return { error: "Admin cannot be added to a team" };
  }

  const assignedUser = selectedUsers.find(
    (user) => user.teamId && user.teamId !== normalizedTeamId
  );
  if (assignedUser) {
    return { error: `${assignedUser.name} is already assigned to another team` };
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "teams"
        SET
          "name" = ${trimmedName},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${normalizedTeamId}
      `;

      await tx.$executeRaw`
        UPDATE "users"
        SET
          "teamId" = NULL,
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "teamId" = ${normalizedTeamId}
          AND "id" NOT IN (${Prisma.join(memberIds)})
      `;

      const assignedRows = await tx.$queryRaw<Array<{ id: string }>>`
        UPDATE "users"
        SET
          "teamId" = ${normalizedTeamId},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "id" IN (${Prisma.join(memberIds)})
          AND "role" <> 'ADMIN'
          AND ("teamId" IS NULL OR "teamId" = ${normalizedTeamId})
        RETURNING "id"
      `;

      if (assignedRows.length !== memberIds.length) {
        throw new Error("TEAM_MEMBER_ASSIGNMENT_FAILED");
      }
    });

    const updatedTeam = await getTeamById(normalizedTeamId);

    if (!updatedTeam) {
      return { error: "Team was updated but could not be loaded" };
    }

    await logActivity({
      action: "UPDATE",
      entityType: "team",
      entityId: updatedTeam.id,
      createdById: admin.id,
      metadata: {
        previousTeamName: existingTeam.name,
        teamName: updatedTeam.name,
        memberCount: updatedTeam.members.length,
      },
    });

    revalidateTeamPaths();
    return { success: true as const, data: updatedTeam };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "Team name already exists" };
    }

    if (error instanceof Error && error.message === "TEAM_MEMBER_ASSIGNMENT_FAILED") {
      return { error: "One or more selected employees were already assigned to another team" };
    }

    throw error;
  }
}

export async function importLegacyTeams(input: LegacyTeamInput[]) {
  const admin = await requireAdmin();
  const normalizedTeams = normalizeLegacyTeams(input);

  if (normalizedTeams.length === 0) {
    return { success: true as const, data: await getAllTeams(), importedCount: 0 };
  }

  const existingTeams = await getAllTeams();
  const existingNames = new Set(existingTeams.map((team) => team.name.toLowerCase()));
  const teamsToImport = normalizedTeams.filter((team) => !existingNames.has(team.normalizedName));

  if (teamsToImport.length === 0) {
    return { success: true as const, data: existingTeams, importedCount: 0 };
  }

  const availableUsers = await getSelectedUsers(
    Array.from(new Set(teamsToImport.flatMap((team) => team.memberIds)))
  );
  const availableUserIds = new Set(
    availableUsers
      .filter((user) => user.role !== "ADMIN" && !user.teamId)
      .map((user) => user.id)
  );

  const claimedUserIds = new Set<string>();
  const createdTeams: Array<{ id: string; name: string; memberCount: number }> = [];
  let importedCount = 0;

  try {
    await db.$transaction(async (tx) => {
      for (const team of teamsToImport) {
        const memberIds = team.memberIds.filter(
          (memberId) => availableUserIds.has(memberId) && !claimedUserIds.has(memberId)
        );

        if (memberIds.length === 0) {
          continue;
        }

        const teamId = randomUUID();
        const createdAt = team.createdAt ?? new Date();

        await tx.$executeRaw`
          INSERT INTO "teams" ("id", "name", "createdAt", "updatedAt")
          VALUES (${teamId}, ${team.name}, ${createdAt}, ${createdAt})
        `;

        await tx.$executeRaw`
          UPDATE "users"
          SET
            "teamId" = ${teamId},
            "updatedAt" = CURRENT_TIMESTAMP
          WHERE
            "id" IN (${Prisma.join(memberIds)})
            AND "teamId" IS NULL
        `;

        memberIds.forEach((memberId) => claimedUserIds.add(memberId));
        createdTeams.push({
          id: teamId,
          name: team.name,
          memberCount: memberIds.length,
        });
        importedCount += 1;
      }
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }

  for (const team of createdTeams) {
    await logActivity({
      action: "CREATE",
      entityType: "team",
      entityId: team.id,
      createdById: admin.id,
      metadata: {
        teamName: team.name,
        memberCount: team.memberCount,
        source: "legacy_local_storage",
      },
    });
  }

  revalidateTeamPaths();
  return { success: true as const, data: await getAllTeams(), importedCount };
}

export async function deleteTeam(teamId: string) {
  const admin = await requireAdmin();
  const normalizedTeamId = teamId.trim();

  if (!normalizedTeamId) {
    return { error: "Team not found" };
  }

  const team = await getTeamById(normalizedTeamId);

  if (!team) {
    return { error: "Team not found" };
  }

  await db.$executeRaw`
    DELETE FROM "teams"
    WHERE "id" = ${normalizedTeamId}
  `;

  await logActivity({
    action: "DELETE",
    entityType: "team",
    entityId: team.id,
    createdById: admin.id,
    metadata: {
      teamName: team.name,
      memberCount: team.members.length,
    },
  });

  revalidateTeamPaths();
  return { success: true as const };
}

export async function removeEmployeeFromTeam(teamId: string, memberId: string) {
  const admin = await requireAdmin();
  const normalizedTeamId = teamId.trim();
  const normalizedMemberId = memberId.trim();

  if (!normalizedTeamId || !normalizedMemberId) {
    return { error: "Employee is not part of this team" };
  }

  const memberRows = await db.$queryRaw<TeamMemberRow[]>`
    SELECT
      u."id" AS "id",
      u."name" AS "name",
      t."id" AS "teamId",
      t."name" AS "teamName"
    FROM "users" AS u
    INNER JOIN "teams" AS t
      ON t."id" = u."teamId"
    WHERE
      u."id" = ${normalizedMemberId}
      AND u."teamId" = ${normalizedTeamId}
    LIMIT 1
  `;

  const member = memberRows[0];

  if (!member) {
    return { error: "Employee is not part of this team" };
  }

  await db.$executeRaw`
    UPDATE "users"
    SET
      "teamId" = NULL,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${member.id}
  `;

  const updatedTeam = await getTeamById(normalizedTeamId);

  if (!updatedTeam) {
    return { error: "Team not found" };
  }

  await logActivity({
    action: "UNASSIGN",
    entityType: "team_member",
    entityId: `${normalizedTeamId}:${normalizedMemberId}`,
    userId: normalizedMemberId,
    createdById: admin.id,
    metadata: {
      teamId: member.teamId,
      teamName: member.teamName,
      employeeName: member.name,
    },
  });

  revalidateTeamPaths();
  return {
    success: true as const,
    data: updatedTeam,
  };
}
