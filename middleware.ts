import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeEmployeePermissions } from "@/lib/employee-permissions";

const authSecret = (() => {
  const secret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "dev-only-auth-secret-change-me"
      : undefined);

  if (!secret) {
    // At build time the secret may not be available; return a placeholder
    // so the module can load. The middleware only runs at request time.
    if (typeof process !== "undefined" && process.env.NEXT_PHASE === "phase-production-build") {
      return "build-time-placeholder";
    }
    throw new Error("Missing AUTH_SECRET/NEXTAUTH_SECRET. Set AUTH_SECRET in your environment.");
  }
  return secret;
})();

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

type MiddlewarePermissions = {
  actionPermissions?: string[];
  moduleAccess?: string[];
};

export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const secureCookies = nextUrl.protocol === "https:";
  const token = await getToken({ req, secret: authSecret, secureCookie: secureCookies });
  const isLoggedIn = !!token;
  const userRole = typeof token?.role === "string" ? token.role : undefined;
  const permissionPayload =
    token?.permissions && typeof token.permissions === "object"
      ? (token.permissions as MiddlewarePermissions)
      : { moduleAccess: toStringArray(token?.moduleAccess) };
  const activePermissions = normalizeEmployeePermissions(permissionPayload);
  const moduleAccess = activePermissions.moduleAccess;
  const actionPermissions = activePermissions.actionPermissions;
  const canCreateByPermission = actionPermissions.includes("CREATE");
  const canUpdateByPermission =
    actionPermissions.includes("UPDATE") || actionPermissions.includes("EDIT");

  const isRegisterPage = nextUrl.pathname.startsWith("/register");

  const isProtectedRoute =
    nextUrl.pathname.startsWith("/dashboard") ||
    nextUrl.pathname.startsWith("/admin") ||
    nextUrl.pathname.startsWith("/employees") ||
    nextUrl.pathname.startsWith("/clients") ||
    nextUrl.pathname.startsWith("/crm") ||
    nextUrl.pathname.startsWith("/projects") ||
    nextUrl.pathname.startsWith("/work-tracking") ||
    nextUrl.pathname.startsWith("/reports") ||
    nextUrl.pathname.startsWith("/activity-logs") ||
    nextUrl.pathname.startsWith("/security");

  const isAdminRoute =
    nextUrl.pathname === "/admin" ||
    nextUrl.pathname === "/employees/new" ||
    nextUrl.pathname.match(/^\/employees\/[^/]+\/edit$/) ||
    nextUrl.pathname.startsWith("/security");

  const isProjectCreateRoute = nextUrl.pathname === "/projects/new";
  const isProjectEditRoute = Boolean(nextUrl.pathname.match(/^\/projects\/[^/]+\/edit$/));
  const isClientRoute = nextUrl.pathname.startsWith("/clients");
  const isClientCreateRoute = nextUrl.pathname === "/clients/new";
  const isClientEditRoute = Boolean(nextUrl.pathname.match(/^\/clients\/[^/]+\/edit$/));
  const isCrmRoute = nextUrl.pathname.startsWith("/crm");
  const isProjectRoute = nextUrl.pathname.startsWith("/projects");

  if (isRegisterPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isAdminRoute && userRole !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (isProjectCreateRoute && userRole !== "ADMIN" && !canCreateByPermission) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (isProjectEditRoute && userRole !== "ADMIN" && !canUpdateByPermission) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (userRole !== "ADMIN") {
    const hasClientModuleAccess =
      moduleAccess.includes("CRM") || moduleAccess.includes("SALES");

    if (isClientRoute && !hasClientModuleAccess) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isClientCreateRoute && !canCreateByPermission) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isClientEditRoute && !canUpdateByPermission) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isCrmRoute && !moduleAccess.includes("CRM")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }

    if (isProjectRoute && !moduleAccess.includes("PROJECT")) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
