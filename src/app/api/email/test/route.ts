import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAdminApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";
import { emailService } from "@/services/email.service";

export async function GET() {
  try {
    await ensureAdminApi();
    return NextResponse.json({
      data: {
        configured: emailService.isConfigured(),
        from: emailService.getFromAddress(),
      },
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

const testEmailSchema = z.object({
  to: z.string().email(),
});

export async function POST(request: Request) {
  try {
    await ensureAdminApi();
    const body = await request.json();
    const parsed = testEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await emailService.sendTest(parsed.data.to);
    return NextResponse.json({ data: result });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
