import { NextResponse } from "next/server";
import { createProductSchema } from "@/schemas/product.schema";
import { productService } from "@/services/product.service";
import { ensureProtectedApi, parseQueryBusinessId } from "@/lib/api";
import { toErrorResponse, AppError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const businessId = parseQueryBusinessId(searchParams);
    if (!businessId) {
      throw new AppError("businessId query parameter is required", 400);
    }
    const search = searchParams.get("search") ?? undefined;
    const includeInactive = searchParams.get("all") === "true";
    const products = await productService.list(businessId, {
      search,
      includeInactive,
    });
    return NextResponse.json({ data: products });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const product = await productService.create(parsed.data);
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
