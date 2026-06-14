import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export interface StoredCollegeEntry {
  id: string;
  name: string;
  country: string | null;
  state: string | null;
  districtCity: string | null;
  placeArea: string | null;
  address: string | null;
}

async function ensureCollegeDirectoryTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "college_directory" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "country" TEXT,
      "state" TEXT,
      "districtCity" TEXT,
      "placeArea" TEXT,
      "address" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.$executeRawUnsafe(`ALTER TABLE "college_directory" ADD COLUMN IF NOT EXISTS "country" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "college_directory" ADD COLUMN IF NOT EXISTS "state" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "college_directory" ADD COLUMN IF NOT EXISTS "districtCity" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "college_directory" ADD COLUMN IF NOT EXISTS "placeArea" TEXT`);
}

export async function fetchStoredColleges(): Promise<StoredCollegeEntry[]> {
  await ensureCollegeDirectoryTable();

  const [directoryRows, clientRows] = await Promise.all([
    db.$queryRaw<StoredCollegeEntry[]>`
      SELECT "id", "name", "country", "state", "districtCity", "placeArea", "address"
      FROM "college_directory"
      ORDER BY
        LOWER(COALESCE("country", '')) ASC,
        LOWER(COALESCE("state", '')) ASC,
        LOWER(COALESCE("districtCity", '')) ASC,
        LOWER(COALESCE("placeArea", '')) ASC,
        LOWER("name") ASC
    `,
    db.client.findMany({
      where: {
        collegeName: {
          not: null,
        },
      },
      select: {
        collegeName: true,
        address: true,
      },
      distinct: ["collegeName"],
      orderBy: {
        collegeName: "asc",
      },
    }),
  ]);

  const merged = new Map<string, StoredCollegeEntry>();

  for (const row of directoryRows) {
    const normalizedName = row.name.trim().toLowerCase();
    if (!normalizedName) {
      continue;
    }

    merged.set(normalizedName, {
      id: row.id,
      name: row.name.trim(),
      country: row.country?.trim() || null,
      state: row.state?.trim() || null,
      districtCity: row.districtCity?.trim() || null,
      placeArea: row.placeArea?.trim() || null,
      address: row.address?.trim() || null,
    });
  }

  for (const row of clientRows) {
    const name = row.collegeName?.trim();
    if (!name) {
      continue;
    }

    const normalizedName = name.toLowerCase();
    if (!merged.has(normalizedName)) {
      merged.set(normalizedName, {
        id: randomUUID(),
        name,
        country: null,
        state: null,
        districtCity: null,
        placeArea: null,
        address: row.address?.trim() || null,
      });
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    const leftCountry = left.country || "";
    const rightCountry = right.country || "";
    if (leftCountry !== rightCountry) {
      return leftCountry.localeCompare(rightCountry);
    }

    const leftState = left.state || "";
    const rightState = right.state || "";
    if (leftState !== rightState) {
      return leftState.localeCompare(rightState);
    }

    const leftDistrict = left.districtCity || "";
    const rightDistrict = right.districtCity || "";
    if (leftDistrict !== rightDistrict) {
      return leftDistrict.localeCompare(rightDistrict);
    }

    const leftPlace = left.placeArea || "";
    const rightPlace = right.placeArea || "";
    if (leftPlace !== rightPlace) {
      return leftPlace.localeCompare(rightPlace);
    }

    return left.name.localeCompare(right.name);
  });
}
