import { NextResponse } from "next/server";
import { inventoryService } from "@/services/inventory.service";
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
    const productId = searchParams.get("productId");
    if (productId) {
      const stock = await inventoryService.getStock(businessId, productId);
      return NextResponse.json({ data: { productId, stock } });
    }
    const summary = await inventoryService.getSummary(businessId);
    return NextResponse.json({ data: summary });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
