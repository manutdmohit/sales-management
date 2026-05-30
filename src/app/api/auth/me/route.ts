import { NextResponse } from "next/server";
import { authService } from "@/services/auth.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    const session = await ensureProtectedApi();
    const user = await authService.getProfile(session.sub);
    return NextResponse.json({ data: user });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
