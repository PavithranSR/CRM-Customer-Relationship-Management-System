import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import authConfig from "@/lib/auth.config";
import type { Role } from "@prisma/client";
import type {
  ActionPermissionOption,
  EmployeePermissions,
  ModuleAccessOption,
  PermissionBucket,
  RecordRuleOption,
} from "@/lib/employee-permissions";
import {
  buildProjectWhereForViewer,
  hasPermission,
  normalizeEmployeePermissions,
} from "@/lib/employee-permissions";

declare module "next-auth" {
  interface User {
    role: Role;
    permissions?: EmployeePermissions | null;
  }

  interface Session {
    user: User & {
      id: string;
      role: Role;
      permissions: EmployeePermissions;
      moduleAccess: EmployeePermissions["moduleAccess"];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: Role;
    permissions: EmployeePermissions;
    moduleAccess: EmployeePermissions["moduleAccess"];
  }
}

/**
 * Lazily resolve the auth secret so the module can be imported at build time
 * (e.g. during `next build` page-data collection) without throwing.
 * The secret is only required at **runtime** when auth is actually invoked.
 */
function getAuthSecret(): string {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "dev-only-auth-secret-change-me"
      : undefined);

  if (!secret) {
    throw new Error(
      "Missing AUTH_SECRET/NEXTAUTH_SECRET. Set AUTH_SECRET or NEXTAUTH_SECRET in your environment."
    );
  }
  return secret;
}

// Use a build-safe placeholder so the module can load at build time.
// NextAuth resolves the real secret via the `secret` option at request time.
const authSecret = (() => {
  try {
    return getAuthSecret();
  } catch {
    // Build time — secret is not available yet; return a placeholder so the
    // module can load. NextAuth will use the real secret at runtime.
    return "build-time-placeholder";
  }
})();

const authUrl =
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

if (!process.env.NEXTAUTH_URL && authUrl) {
  process.env.NEXTAUTH_URL = authUrl;
}

function getAuthErrorType(error: Error) {
  return "type" in error && typeof (error as { type?: unknown }).type === "string"
    ? (error as { type: string }).type
    : error.name;
}

function isRecoverableSessionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const details = `${error.name} ${getAuthErrorType(error)} ${error.message}`;

  return /JWTSessionError|SessionTokenError/i.test(details);
}

function logUnexpectedAuthError(error: Error) {
  const errorType = getAuthErrorType(error);
  console.error(`[auth][error] ${errorType}: ${error.message}`);

  if (
    error.cause &&
    typeof error.cause === "object" &&
    "err" in error.cause &&
    (error.cause as { err?: unknown }).err instanceof Error
  ) {
    const { err, ...details } = error.cause as { err: Error } & Record<string, unknown>;
    console.error("[auth][cause]:", err.stack);
    if (Object.keys(details).length > 0) {
      console.error("[auth][details]:", JSON.stringify(details, null, 2));
    }
    return;
  }

  if (error.stack) {
    console.error(error.stack.replace(/.*/, "").substring(1));
  }
}

function isDatabaseRefreshError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "PrismaClientInitializationError" ||
    error.name === "PrismaClientKnownRequestError" ||
    /Can't reach database server|Timed out fetching a new connection|Connection/i.test(error.message)
  );
}

const authInstance = NextAuth({
  adapter: PrismaAdapter(db) as never,
  session: { strategy: "jwt" },
  trustHost: true,
  secret: authSecret,
  logger: {
    error(error) {
      if (isRecoverableSessionError(error)) {
        return;
      }
      logUnexpectedAuthError(error);
    },
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const normalizedPermissions = normalizeEmployeePermissions(user.permissions, {
          enforceAccessWindow: false,
        });
        token.id = user.id!;
        token.role = user.role;
        token.permissions = normalizedPermissions;
        token.moduleAccess = normalizedPermissions.moduleAccess;
        return token;
      }

      if (token.id) {
        let currentUser;

        try {
          currentUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              role: true,
              permissions: true,
              isActive: true,
            },
          });
        } catch (error) {
          if (isDatabaseRefreshError(error)) {
            console.warn(
              "[auth][jwt] Failed to refresh user from the database. Reusing the existing token."
            );
            return token;
          }

          throw error;
        }

        if (!currentUser || !currentUser.isActive) {
          return {};
        }

        const normalizedPermissions = normalizeEmployeePermissions(currentUser.permissions, {
          enforceAccessWindow: false,
        });
        token.id = currentUser.id;
        token.role = currentUser.role;
        token.permissions = normalizedPermissions;
        token.moduleAccess = normalizedPermissions.moduleAccess;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.permissions = normalizeEmployeePermissions(token.permissions);
        session.user.moduleAccess = session.user.permissions.moduleAccess;
      }
      return session;
    },
  },
  ...authConfig,
});

export const handlers = authInstance.handlers;
export const rawAuth = authInstance.auth;
export const signIn = authInstance.signIn;
export const signOut = authInstance.signOut;

export async function auth() {
  try {
    return await rawAuth();
  } catch (error) {
    if (isRecoverableSessionError(error)) {
      return null;
    }

    throw error;
  }
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export async function requireManagerOrAdmin() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && user.role !== "BA" && user.role !== "TEAMLEADER") {
    throw new Error("Forbidden: Admin, BA, or Team Leader access required");
  }
  return user;
}

export async function requireCrmAccess() {
  const user = await requireAuth();
  if (user.role !== "ADMIN" && !user.moduleAccess.includes("CRM")) {
    throw new Error("Forbidden: CRM access required");
  }
  return user;
}

export async function requirePermission<K extends PermissionBucket>(
  bucket: K,
  value: EmployeePermissions[K][number]
) {
  const user = await requireAuth();
  if (user.role === "ADMIN") {
    return user;
  }

  if (!hasPermission(user.permissions, bucket, value)) {
    throw new Error(`Forbidden: Missing permission ${bucket}:${String(value)}`);
  }

  return user;
}

export async function requireModuleAccess(module: ModuleAccessOption) {
  return requirePermission("moduleAccess", module);
}

export async function requireRecordRule(rule: RecordRuleOption) {
  return requirePermission("recordRules", rule);
}

export function hasActionPermission(
  permissions: EmployeePermissions | null | undefined,
  action: ActionPermissionOption
) {
  return hasPermission(permissions, "actionPermissions", action);
}

export function canAccessAction(input: {
  role?: Role | string | null;
  permissions?: EmployeePermissions | null;
  action: ActionPermissionOption;
  module?: ModuleAccessOption;
}) {
  if (input.role === "ADMIN") {
    return true;
  }

  if (input.module && !hasPermission(input.permissions, "moduleAccess", input.module)) {
    return false;
  }

  return hasActionPermission(input.permissions, input.action);
}

export async function requireActionPermission(
  action: ActionPermissionOption,
  module?: ModuleAccessOption
) {
  const user = await requireAuth();
  if (!canAccessAction({ role: user.role, permissions: user.permissions, action, module })) {
    if (module && !hasPermission(user.permissions, "moduleAccess", module)) {
      throw new Error(`Forbidden: Missing module access ${module}`);
    }
    throw new Error(`Forbidden: Missing permission actionPermissions:${action}`);
  }

  return user;
}

export async function requireProjectRecordAccess(projectId: string) {
  const user = await requireAuth();
  if (user.role === "ADMIN") {
    return user;
  }

  const projectWhere = buildProjectWhereForViewer({
    userId: user.id,
    role: user.role,
    permissions: user.permissions,
  });

  const canAccess = await db.project.count({
    where: {
      id: projectId,
      ...projectWhere,
    },
  });

  if (canAccess === 0) {
    throw new Error("Forbidden: Record rule does not allow access to this project");
  }

  return user;
}
