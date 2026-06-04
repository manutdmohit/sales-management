import { NextResponse } from "next/server";
import { createPurchaseSchema } from "@/schemas/purchase.schema";
import { purchaseService } from "@/services/purchase.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const PURCHASE_SORT_FIELDS = ["createdAt", "supplierName", "total"] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const search = searchParams.get("search") ?? undefined;
    const { sort, dir } = parseSortParams(searchParams, PURCHASE_SORT_FIELDS, {
      sort: "createdAt",
      dir: "desc",
    });
    const pagination = parsePaginationParams(searchParams);
    const purchases = await purchaseService.list(businessId, {
      search,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(purchases);
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
