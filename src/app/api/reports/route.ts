import { NextResponse } from "next/server";
import { reportQuerySchema } from "@/schemas/report.schema";
import { reportService } from "@/services/report.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse, AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);

    const parsed = reportQuerySchema.safeParse({
      businessId: searchParams.get("businessId"),
      kind: searchParams.get("kind") ?? "sales",
      period: searchParams.get("period") ?? "daily",
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const report = await reportService.getReport(parsed.data);
    return NextResponse.json({ data: report });
  } catch (error) {
    if (error instanceof Error && error.message.includes("from and to")) {
      const { body } = toErrorResponse(
        new AppError(error.message, 400, "INVALID_RANGE")
      );
      return NextResponse.json(body, { status: 400 });
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
