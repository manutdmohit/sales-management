import { NextResponse } from "next/server";
import { dashboardQuerySchema } from "@/schemas/dashboard.schema";
import { dashboardService } from "@/services/dashboard.service";
import { ensureProtectedApi, parseQueryBusinessId } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    const parsed = dashboardQuerySchema.safeParse({
      businessId,
      period: searchParams.get("period") ?? "daily",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = await dashboardService.getDashboard(
      parsed.data.businessId,
      parsed.data.period
    );
    return NextResponse.json({ data });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
