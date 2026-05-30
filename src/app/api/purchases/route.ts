import { NextResponse } from "next/server";
import { createPurchaseSchema } from "@/schemas/purchase.schema";
import { purchaseService } from "@/services/purchase.service";
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
    const purchases = await purchaseService.list(businessId);
    return NextResponse.json({ data: purchases });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createPurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const purchase = await purchaseService.create(parsed.data);
    return NextResponse.json({ data: purchase }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
