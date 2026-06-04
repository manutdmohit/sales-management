import { NextResponse } from "next/server";
import { createCategorySchema } from "@/schemas/category.schema";
import { categoryService } from "@/services/category.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const CATEGORY_SORT_FIELDS = ["name", "sortOrder", "createdAt"] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const search = searchParams.get("search") ?? undefined;
    const includeInactive = searchParams.get("all") === "true";
    const { sort, dir } = parseSortParams(searchParams, CATEGORY_SORT_FIELDS, {
      sort: "sortOrder",
      dir: "asc",
    });
    const pagination = parsePaginationParams(searchParams);
    const categories = await categoryService.list(businessId, {
      search,
      includeInactive,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(categories);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const category = await categoryService.create(parsed.data);
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
