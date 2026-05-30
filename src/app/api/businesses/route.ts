import { NextResponse } from "next/server";
import { createBusinessSchema } from "@/schemas/business.schema";
import { businessService } from "@/services/business.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    await ensureProtectedApi();
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("all") === "true";
    const businesses = await businessService.list({ includeInactive });
    return NextResponse.json({ data: businesses });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureProtectedApi();
    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const business = await businessService.create(parsed.data);
    return NextResponse.json({ data: business }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
