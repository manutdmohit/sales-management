import { NextResponse } from "next/server";
import { receivablesService } from "@/services/receivables.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const RECEIVABLE_SORT_FIELDS = [
  "dueDate",
  "createdAt",
  "total",
  "amountDue",
  "customer.name",
] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const outstandingOnly = searchParams.get("outstandingOnly") === "true";
    const search = searchParams.get("search") ?? undefined;
    const { sort, dir } = parseSortParams(searchParams, RECEIVABLE_SORT_FIELDS, {
      sort: "dueDate",
      dir: "asc",
    });
    const pagination = parsePaginationParams(searchParams);
    const receivables = await receivablesService.list(businessId, {
      outstandingOnly,
      search,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(receivables);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
