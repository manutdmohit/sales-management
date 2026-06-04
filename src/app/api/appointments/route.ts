import { NextResponse } from "next/server";
import { createAppointmentSchema } from "@/schemas/appointment.schema";
import { appointmentService } from "@/services/appointment.service";
import {
  ensureProtectedApi,
  parsePaginationParams,
  parseQueryBusinessId,
  parseSortParams,
} from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse, AppError } from "@/lib/errors";

const APPOINTMENT_SORT_FIELDS = [
  "startAt",
  "customerName",
  "serviceName",
  "status",
  "price",
] as const;

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const { sort, dir } = parseSortParams(
      searchParams,
      APPOINTMENT_SORT_FIELDS,
      { sort: "startAt", dir: "asc" }
    );
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const pagination = parsePaginationParams(searchParams);
    const appointments = await appointmentService.list(businessId, {
      status,
      search,
      sort,
      dir,
      ...(fromParam && { from: new Date(fromParam) }),
      ...(toParam && { to: new Date(toParam) }),
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(appointments);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const appointment = await appointmentService.create(parsed.data);
    return NextResponse.json({ data: appointment }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
