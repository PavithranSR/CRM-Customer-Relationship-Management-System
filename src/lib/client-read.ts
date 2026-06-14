import { db } from "@/lib/db";
import { fetchStoredColleges, type StoredCollegeEntry } from "@/lib/college-directory-data";

export interface ClientRecord {
  id: string;
  name: string;
  collegeName: string | null;
  courseName: string | null;
  email: string;
  phone: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  state: string | null;
  country: string | null;
  serviceName: string | null;
  projectName: string | null;
  tags: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  createdBy: {
    name: string | null;
  } | null;
}

export { fetchStoredColleges, type StoredCollegeEntry };

export async function fetchClientById(id: string): Promise<ClientRecord | null> {
  const rows = await db.$queryRaw<ClientRecord[]>`
    SELECT
      "id",
      "name",
      "collegeName",
      "courseName",
      "email",
      "phone",
      "street",
      "city",
      "zip",
      "state",
      "country",
      "serviceName",
      "projectName",
      "tags",
      "address",
      "notes",
      "isActive",
      "createdAt",
      "updatedAt"
    FROM "clients"
    WHERE "id" = ${id}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function fetchClientActivityLogs(
  clientId: string,
  limit = 20
): Promise<ClientActivityLogEntry[]> {
  return db.activityLog.findMany({
    where: {
      entityType: "client",
      entityId: clientId,
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(100, limit)),
    include: {
      createdBy: { select: { name: true } },
    },
  }) as Promise<ClientActivityLogEntry[]>;
}
