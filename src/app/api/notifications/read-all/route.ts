import { NextResponse } from "next/server";
import { z } from "zod";
import { notificationService } from "@/services/notification.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

const bodySchema = z.object({
  businessId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const count = await notificationService.markAllRead(parsed.data.businessId);
    return NextResponse.json({ data: { marked: count } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
