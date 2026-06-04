import { AppError } from "@/lib/errors";
import { requireAuth } from "./require-auth";
import type { SessionUser } from "./session";

/** Guard for admin-only API routes. Throws 403 for non-admins. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new AppError("Admin access required", 403, "FORBIDDEN");
  }
  return session;
}
