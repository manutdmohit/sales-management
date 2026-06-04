import { NextResponse } from "next/server";
import { sendClientEmailSchema } from "@/schemas/client-email.schema";
import { clientService } from "@/services/client.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await ensureProtectedApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = sendClientEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await clientService.sendEmail(id, parsed.data, {
      name: session.name,
      email: session.email,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
