import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { SessionUser } from "@/lib/auth/session";

/** Use on every protected API route (all except /api/auth/login). */
export async function ensureProtectedApi(): Promise<SessionUser> {
  const session = await requireAuth();
  await connectDb();
  return session;
}

/** Use on admin-only API routes (e.g. team management). */
export async function ensureAdminApi(): Promise<SessionUser> {
  const session = await requireAdmin();
  await connectDb();
  return session;
}

export function parseQueryBusinessId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get("businessId");
}

export { parsePaginationParams, parseSortParams } from "@/lib/pagination";
