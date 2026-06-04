import { NextResponse } from "next/server";
import { createServiceSchema } from "@/schemas/service.schema";
import { serviceCatalogService } from "@/services/service-catalog.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const SERVICE_SORT_FIELDS = [
  "name",
  "category",
  "price",
  "durationMinutes",
] as const;

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
    const { sort, dir } = parseSortParams(searchParams, SERVICE_SORT_FIELDS, {
      sort: "name",
      dir: "asc",
    });
    const pagination = parsePaginationParams(searchParams);
    const services = await serviceCatalogService.list(businessId, {
      search,
      includeInactive,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(services);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const service = await serviceCatalogService.create(parsed.data);
    return NextResponse.json({ data: service }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
