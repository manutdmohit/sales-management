import { NextResponse } from "next/server";
import { createProductionRunSchema } from "@/schemas/production.schema";
import { productionService } from "@/services/production.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const PRODUCTION_SORT_FIELDS = ["createdAt", "finishedProductName"] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const search = searchParams.get("search") ?? undefined;
    const { sort, dir } = parseSortParams(searchParams, PRODUCTION_SORT_FIELDS, {
      sort: "createdAt",
      dir: "desc",
    });
    const pagination = parsePaginationParams(searchParams);
    const runs = await productionService.list(businessId, {
      search,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(runs);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createProductionRunSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const run = await productionService.create(parsed.data);
    return NextResponse.json({ data: run }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
