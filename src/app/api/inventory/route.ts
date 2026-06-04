import { NextResponse } from "next/server";
import { inventoryService } from "@/services/inventory.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const INVENTORY_SORT_FIELDS = ["name", "sku", "minStock"] as const;

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
    const search = searchParams.get("search") ?? undefined;
    const productKindParam = searchParams.get("productKind");
    const productKind =
      productKindParam === "RAW" || productKindParam === "FINISHED"
        ? productKindParam
        : undefined;
    const { sort, dir } = parseSortParams(searchParams, INVENTORY_SORT_FIELDS, {
      sort: "name",
      dir: "asc",
    });
    const pagination = parsePaginationParams(searchParams);
    const summary = await inventoryService.getSummary(businessId, {
      search,
      productKind,
      sort,
      dir,
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
