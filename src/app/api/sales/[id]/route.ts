import { NextResponse } from "next/server";
import { updateSaleSchema } from "@/schemas/sale.schema";
import { salesService } from "@/services/sales.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const sale = await salesService.getById(id);
    return NextResponse.json({ data: sale });
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
    const parsed = updateSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const sale = await salesService.update(id, parsed.data);
    return NextResponse.json({ data: sale });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
