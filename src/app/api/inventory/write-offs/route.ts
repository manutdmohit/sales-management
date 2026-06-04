import { NextResponse } from "next/server";
import { writeOffBatchSchema } from "@/schemas/inventory.schema";
import { inventoryService } from "@/services/inventory.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = writeOffBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const tx = await inventoryService.writeOffBatch(parsed.data);
    return NextResponse.json({ data: tx }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
