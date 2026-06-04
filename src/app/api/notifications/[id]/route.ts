import { NextResponse } from "next/server";
import { notificationService } from "@/services/notification.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const notification = await notificationService.markRead(id);
    return NextResponse.json({ data: notification });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    await notificationService.delete(id);
    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
