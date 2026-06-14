import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { loginSchema } from "@/lib/validations/auth.schema";
import { db, isDatabaseConfigured } from "@/lib/db";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

export class CredentialSystemError extends Error {
  constructor(public readonly code: "DATABASE_NOT_CONFIGURED" | "DATABASE_QUERY_FAILED") {
    super(
      code === "DATABASE_NOT_CONFIGURED"
        ? "Missing database configuration for login."
        : "Database query failed during login."
    );
    this.name = "CredentialSystemError";
  }
}

export async function getUserFromCredentials(credentials: unknown) {
  const validatedFields = loginSchema.safeParse(credentials);

  if (!validatedFields.success) {
    return null;
  }

  if (!isDatabaseConfigured) {
    console.error(
      "Login blocked: missing database URL. Set DATABASE_URL, DATABASE_URL_UNPOOLED, POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, or POSTGRES_URL."
    );
    throw new CredentialSystemError("DATABASE_NOT_CONFIGURED");
  }

  const email = validatedFields.data.email.trim().toLowerCase();
  const { password } = validatedFields.data;
  let user;

  try {
    user = await db.user.findUnique({
      where: { email },
    });
  } catch (error) {
    console.error("Login query failed:", error);
    throw new CredentialSystemError("DATABASE_QUERY_FAILED");
  }

  if (!user || !user.password || !user.isActive) {
    return null;
  }

  const passwordsMatch = await bcrypt.compare(password, user.password);
  if (!passwordsMatch) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: normalizeEmployeePermissions((user as { permissions?: unknown }).permissions, {
      enforceAccessWindow: false,
    }),
    image: user.avatar,
  };
}

export default {
  providers: [
    Credentials({
      async authorize(credentials) {
        return getUserFromCredentials(credentials);
      },
    }),
  ],
} satisfies NextAuthConfig;
