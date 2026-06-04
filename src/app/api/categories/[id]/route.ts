import { NextResponse } from "next/server";
import { updateCategorySchema } from "@/schemas/category.schema";
import { categoryService } from "@/services/category.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const category = await categoryService.update(id, parsed.data);
    return NextResponse.json({ data: category });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
