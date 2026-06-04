import { NextResponse } from "next/server";
import { updateSupplierSchema } from "@/schemas/supplier.schema";
import { supplierService } from "@/services/supplier.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const supplier = await supplierService.getDetail(id);
    return NextResponse.json({ data: supplier });
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
    const parsed = updateSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const supplier = await supplierService.update(id, {
      ...parsed.data,
      email: parsed.data.email || undefined,
    });
    return NextResponse.json({ data: supplier });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
