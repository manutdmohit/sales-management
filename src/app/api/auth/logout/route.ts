import { NextResponse } from "next/server";
import { clearSessionCookieOptions } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(clearSessionCookieOptions());
  return response;
}
