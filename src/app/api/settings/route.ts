import { NextResponse } from "next/server";
import { updateAppSettingsSchema } from "@/schemas/app-settings.schema";
import { appSettingsService } from "@/services/app-settings.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

export async function GET() {
  try {
    await ensureProtectedApi();
    const defaultTablePageSize = await appSettingsService.getTablePageSize();
    return NextResponse.json({ data: { defaultTablePageSize } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = updateAppSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const settings = await appSettingsService.updateTablePageSize(
      parsed.data.defaultTablePageSize
    );
    return NextResponse.json({ data: settings });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
