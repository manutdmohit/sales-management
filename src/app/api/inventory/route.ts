import { NextResponse } from "next/server";
import { inventoryService } from "@/services/inventory.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
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
    const pagination = parsePaginationParams(searchParams);
    const summary = await inventoryService.getSummary(businessId, {
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(summary);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
