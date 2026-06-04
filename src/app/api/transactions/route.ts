import { NextResponse } from "next/server";
import { transactionService } from "@/services/transaction.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";
import type { TransactionKindFilter } from "@/repositories/transaction.repository";

const KIND_VALUES: TransactionKindFilter[] = ["all", "sale", "booking"];

function parseKind(value: string | null): TransactionKindFilter {
  if (value && KIND_VALUES.includes(value as TransactionKindFilter)) {
    return value as TransactionKindFilter;
  }
  return "all";
}

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const kind = parseKind(searchParams.get("kind"));
    const search = searchParams.get("search") ?? undefined;
    const pagination = parsePaginationParams(searchParams);
    const transactions = await transactionService.list(businessId, {
      kind,
      search,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(transactions);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
