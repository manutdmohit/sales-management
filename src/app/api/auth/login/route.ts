import { NextResponse } from "next/server";
import { loginSchema } from "@/schemas/auth.schema";
import { authService } from "@/services/auth.service";
import { ensureDbReady } from "@/lib/api";
import { sessionCookieOptions } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    await ensureDbReady();
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, user } = await authService.login(parsed.data);
    const response = NextResponse.json({ data: { user } });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
