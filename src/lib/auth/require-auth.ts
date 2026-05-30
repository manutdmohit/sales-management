import { AppError } from "@/lib/errors";
import { getSession, type SessionUser } from "./session";

export async function requireAuth(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return session;
}
