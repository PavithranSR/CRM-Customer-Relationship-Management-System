import "server-only";

import { Prisma, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import type { TeamListItem, TeamMemberListItem } from "@/lib/teams";

type QueryClient = typeof db | Prisma.TransactionClient;

interface TeamListRow {
  teamId: string;
  teamName: string;
  teamCreatedAt: Date;
  memberId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  memberRole: Role | null;
}

function toIsoString(value: Date | string) {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapTeamRows(rows: TeamListRow[]): TeamListItem[] {
  const grouped = new Map<string, TeamListItem>();

  rows.forEach((row) => {
    const existing =
      grouped.get(row.teamId) ??
      {
        id: row.teamId,
        name: row.teamName,
        createdAt: toIsoString(row.teamCreatedAt),
        members: [] as TeamMemberListItem[],
      };

    if (!grouped.has(row.teamId)) {
      grouped.set(row.teamId, existing);
    }

    if (row.memberId && row.memberName && row.memberEmail && row.memberRole) {
      existing.members.push({
        id: row.memberId,
        name: row.memberName,
        email: row.memberEmail,
        role: row.memberRole,
      });
    }
  });

  return Array.from(grouped.values());
}

async function listTeamsWithClient(client: QueryClient, memberUserId?: string) {
  const whereClause = memberUserId
    ? Prisma.sql`
        WHERE EXISTS (
          SELECT 1
          FROM "users" AS "member_filter"
          WHERE "member_filter"."teamId" = t."id"
            AND "member_filter"."id" = ${memberUserId}
        )
      `
    : Prisma.empty;

  const rows = await client.$queryRaw<TeamListRow[]>`
    SELECT
      t."id" AS "teamId",
      t."name" AS "teamName",
      t."createdAt" AS "teamCreatedAt",
      u."id" AS "memberId",
      u."name" AS "memberName",
      u."email" AS "memberEmail",
      u."role" AS "memberRole"
    FROM "teams" AS t
    LEFT JOIN "users" AS u
      ON u."teamId" = t."id"
    ${whereClause}
    ORDER BY
      t."createdAt" DESC,
      t."name" ASC,
      u."name" ASC NULLS LAST,
      u."createdAt" DESC NULLS LAST
  `;

  return mapTeamRows(rows);
}

export async function getAllTeams(client: QueryClient = db) {
  return listTeamsWithClient(client);
}

export async function getTeamsForMember(userId: string, client: QueryClient = db) {
  return listTeamsWithClient(client, userId);
}

export async function getTeamById(teamId: string, client: QueryClient = db) {
  const rows = await client.$queryRaw<TeamListRow[]>`
    SELECT
      t."id" AS "teamId",
      t."name" AS "teamName",
      t."createdAt" AS "teamCreatedAt",
      u."id" AS "memberId",
      u."name" AS "memberName",
      u."email" AS "memberEmail",
      u."role" AS "memberRole"
    FROM "teams" AS t
    LEFT JOIN "users" AS u
      ON u."teamId" = t."id"
    WHERE t."id" = ${teamId}
    ORDER BY
      t."createdAt" DESC,
      t."name" ASC,
      u."name" ASC NULLS LAST,
      u."createdAt" DESC NULLS LAST
  `;

  return mapTeamRows(rows)[0] ?? null;
}

export async function getTeamNameForUser(userId: string, client: QueryClient = db) {
  const rows = await client.$queryRaw<Array<{ teamName: string }>>`
    SELECT t."name" AS "teamName"
    FROM "teams" AS t
    INNER JOIN "users" AS u
      ON u."teamId" = t."id"
    WHERE u."id" = ${userId}
    LIMIT 1
  `;

  return rows[0]?.teamName ?? null;
}
