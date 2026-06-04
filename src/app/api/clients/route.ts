import { NextResponse } from "next/server";
import { createClientSchema } from "@/schemas/client.schema";
import { clientService } from "@/services/client.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const CLIENT_SORT_FIELDS = ["name", "phone", "email", "createdAt"] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const search = searchParams.get("search") ?? undefined;
    const { sort, dir } = parseSortParams(searchParams, CLIENT_SORT_FIELDS, {
      sort: "name",
      dir: "asc",
    });
    const pagination = parsePaginationParams(searchParams);
    const clients = await clientService.list(businessId, {
      search,
      sort,
      dir,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(clients);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createClientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const client = await clientService.create({
      ...parsed.data,
      email: parsed.data.email || undefined,
    });
    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
