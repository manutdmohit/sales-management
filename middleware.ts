import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import {
  canAccessApi,
  canAccessPage,
  staffHomePath,
} from "@/domain/roles";

/** Only these paths are reachable without a session. */
function isPublicRoute(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (pathname === "/login") {
    return true;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    return true;
  }

  if (
    pathname === "/api/cron/reminders" &&
    (method === "GET" || method === "POST")
  ) {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSessionFromRequest(request);
  const isAuthenticated = Boolean(session);

  if (pathname === "/login") {
    if (isAuthenticated) {
      const home =
        session!.role === "STAFF" ? staffHomePath() : "/";
      return NextResponse.redirect(new URL(home, request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    if (!isPublicRoute(request)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  if (session) {
    if (pathname.startsWith("/api/")) {
      if (!canAccessApi(session.role, pathname, request.method)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!canAccessPage(session.role, pathname)) {
      return NextResponse.redirect(new URL(staffHomePath(), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
