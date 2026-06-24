import { NextResponse } from "next/server";
import { z } from "zod";
import { businessCookieOptions } from "@/lib/business-cookie";
import { ensureProtectedApi } from "@/lib/api";
import { connectDb } from "@/lib/db";
import { toErrorResponse, AppError } from "@/lib/errors";
import { businessService } from "@/services/business.service";

const selectBusinessSchema = z.object({
  businessId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    await connectDb();
    const body = await request.json();
    const parsed = selectBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await businessService.getById(parsed.data.businessId);

    const response = NextResponse.json({ data: { businessId: parsed.data.businessId } });
    response.cookies.set(businessCookieOptions(parsed.data.businessId));
    return response;
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
