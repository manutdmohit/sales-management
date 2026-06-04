import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { SessionUser } from "@/lib/auth/session";
import { ensureIndexes } from "@/repositories/indexes";

let ready: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await connectDb();
      await ensureIndexes();
    })();
  }
  await ready;
}

/** Use on every protected API route (all except /api/auth/login). */
export async function ensureProtectedApi(): Promise<SessionUser> {
  const session = await requireAuth();
  await ensureDbReady();
  return session;
}

/** Use on admin-only API routes (e.g. team management). */
export async function ensureAdminApi(): Promise<SessionUser> {
  const session = await requireAdmin();
  await ensureDbReady();
  return session;
}

export function parseQueryBusinessId(
  searchParams: URLSearchParams
): string | null {
  return searchParams.get("businessId");
}

export { parsePaginationParams, parseSortParams } from "@/lib/pagination";
