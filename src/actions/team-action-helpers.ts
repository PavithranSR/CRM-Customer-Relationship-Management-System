import { revalidatePath } from "next/cache";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/lib/db";

export interface LegacyTeamInput {
  name: string;
  memberIds: string[];
  createdAt?: string;
}

export interface SelectedUserRow {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
}

export interface TeamNameRow {
  id: string;
}

export interface TeamMemberRow {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
}

export function normalizeMemberIds(memberIds: string[]) {
  return Array.from(
    new Set(
      memberIds
        .map((memberId) => memberId.trim())
        .filter(Boolean)
    )
  );
}

export function revalidateTeamPaths() {
  revalidatePath("/team-management");
  revalidatePath("/teams");
  revalidatePath("/my-team");
  revalidatePath("/profile");
}

export function normalizeLegacyTeams(input: LegacyTeamInput[]) {
  const seenNames = new Set<string>();

  return input
    .map((team) => {
      const name = team.name.trim();
      const memberIds = normalizeMemberIds(team.memberIds);
      const createdAt = team.createdAt?.trim() ? new Date(team.createdAt) : null;

      return {
        name,
        normalizedName: name.toLowerCase(),
        memberIds,
        createdAt:
          createdAt && !Number.isNaN(createdAt.getTime())
            ? createdAt
            : null,
      };
    })
    .filter((team) => {
      if (!team.name || team.memberIds.length === 0 || seenNames.has(team.normalizedName)) {
        return false;
      }

      seenNames.add(team.normalizedName);
      return true;
    });
}

export async function findTeamNameByName(name: string) {
  const rows = await db.$queryRaw<TeamNameRow[]>`
    SELECT "id"
    FROM "teams"
    WHERE LOWER("name") = LOWER(${name})
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getSelectedUsers(memberIds: string[]) {
  if (memberIds.length === 0) {
    return [];
  }

  return db.$queryRaw<SelectedUserRow[]>`
    SELECT
      "id",
      "name",
      "role",
      "teamId"
    FROM "users"
    WHERE "id" IN (${Prisma.join(memberIds)})
  `;
}

