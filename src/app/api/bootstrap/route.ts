import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BUSINESS_COOKIE } from "@/lib/business-cookie";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";
import { bootstrapService } from "@/services/bootstrap.service";

export async function GET() {
  try {
    const session = await ensureProtectedApi();
    const cookieStore = await cookies();
    const preferredBusinessId =
      cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
    const data = await bootstrapService.getForSession(
      session,
      preferredBusinessId
    );
    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
