import { NextResponse } from "next/server";
import { expiryService } from "@/services/expiry.service";
import { ensureProtectedApi, parseQueryBusinessId } from "@/lib/api";
import { toErrorResponse, AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const alerts = await expiryService.listAlerts(businessId);
    return NextResponse.json({ data: alerts });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
