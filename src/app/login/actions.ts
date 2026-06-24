"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authService } from "@/services/auth.service";
import { connectDb } from "@/lib/db";
import { sessionCookieOptions } from "@/lib/auth/session";
import { staffHomePath } from "@/domain/roles";
import { loginSchema } from "@/schemas/auth.schema";

function loginErrorRedirect(from?: string): never {
  const params = new URLSearchParams({ error: "invalid" });
  if (from) params.set("from", from);
  redirect(`/login?${params.toString()}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fromRaw = String(formData.get("from") ?? "").trim();
  const from = fromRaw || undefined;

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    loginErrorRedirect(from);
  }

  let token: string;
  let role: string;

  try {
    await connectDb();
    const result = await authService.login(parsed.data);
    token = result.token;
    role = result.user.role;
  } catch {
    loginErrorRedirect(from);
  }

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions(token));

  let target = from || "/";
  if (role === "STAFF") {
    const allowed = from?.startsWith("/pos") || from?.startsWith("/bookings");
    target = allowed && from ? from : staffHomePath();
  }

  redirect(target);
}
