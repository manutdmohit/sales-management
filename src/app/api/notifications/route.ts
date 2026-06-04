import { NextResponse } from "next/server";
import { expiryService } from "@/services/expiry.service";
import { notificationService } from "@/services/notification.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const countOnly = searchParams.get("countOnly") === "true";

    await expiryService.refreshExpiryNotifications(businessId);

    if (countOnly) {
      const count = await notificationService.unreadCount(businessId);
      return NextResponse.json({ data: { count } });
    }

    const pagination = parsePaginationParams(searchParams);
    const notifications = await notificationService.list(businessId, {
      unreadOnly,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(notifications);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
