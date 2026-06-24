import type { NextRequest } from "next/server";
import { SESSION_MAX_AGE } from "@/lib/auth/constants";
import type { Business } from "@/domain/types";

export const BUSINESS_COOKIE = "inventory_business_id";
export const BUSINESS_COOKIE_MAX_AGE = SESSION_MAX_AGE;

export function resolveBusinessId(
  businesses: Business[],
  preferredId?: string | null
): string | null {
  if (preferredId && businesses.some((business) => business._id === preferredId)) {
    return preferredId;
  }
  return businesses[0]?._id ?? null;
}

export function businessCookieOptions(businessId: string) {
  return {
    name: BUSINESS_COOKIE,
    value: businessId,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: BUSINESS_COOKIE_MAX_AGE,
  };
}

export function readBusinessIdFromRequest(
  request: NextRequest
): string | null {
  return request.cookies.get(BUSINESS_COOKIE)?.value ?? null;
}
