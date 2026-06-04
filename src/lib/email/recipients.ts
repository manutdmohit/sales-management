import type { UserRole } from "@/domain/roles";
import { userRepository } from "@/repositories/user.repository";

/** Optional override: NOTIFICATION_EMAIL=admin@a.com,admin@b.com */
function envOverride(): string[] {
  const raw = process.env.NOTIFICATION_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function getAdminNotificationEmails(): Promise<string[]> {
  const override = envOverride();
  if (override.length > 0) return [...new Set(override)];

  const admins = await userRepository.findActiveByRole("ADMIN");
  return [...new Set(admins.map((u) => u.email))];
}

export async function getActiveEmailsByRole(role: UserRole): Promise<string[]> {
  const users = await userRepository.findActiveByRole(role);
  return [...new Set(users.map((u) => u.email))];
}

export function getAppLoginUrl(): string {
  const base =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/login`;
}
