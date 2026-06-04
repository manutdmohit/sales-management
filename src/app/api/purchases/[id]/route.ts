import { NextResponse } from "next/server";
import { updatePurchaseSchema } from "@/schemas/purchase.schema";
import { purchaseService } from "@/services/purchase.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const purchase = await purchaseService.getById(id);
    return NextResponse.json({ data: purchase });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = updatePurchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const purchase = await purchaseService.update(id, parsed.data);
    return NextResponse.json({ data: purchase });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
