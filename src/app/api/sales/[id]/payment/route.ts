import { NextResponse } from "next/server";
import { recordPaymentSchema } from "@/schemas/sale.schema";
import { salesService } from "@/services/sales.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const sale = await salesService.recordPayment(id, parsed.data);
    return NextResponse.json({ data: sale });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
