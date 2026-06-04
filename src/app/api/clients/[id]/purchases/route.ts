import { NextResponse } from "next/server";
import { clientService } from "@/services/client.service";
import { ensureProtectedApi, parsePaginationParams } from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const pagination = parsePaginationParams(searchParams);
    const purchases = await clientService.listPurchases(id, {
      search,
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
