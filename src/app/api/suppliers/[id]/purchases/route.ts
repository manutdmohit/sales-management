import { NextResponse } from "next/server";
import { supplierService } from "@/services/supplier.service";
import { ensureProtectedApi, parsePaginationParams } from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const pagination = parsePaginationParams(searchParams);
    const purchases = await supplierService.listPurchases(id, {
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
