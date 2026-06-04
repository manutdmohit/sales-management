import { NextResponse } from "next/server";
import { createTeamMemberSchema } from "@/schemas/team.schema";
import { teamService } from "@/services/team.service";
import { ensureAdminApi, parsePaginationParams } from "@/lib/api";
import { jsonListResponse } from "@/lib/paginated-response";
import { toErrorResponse } from "@/lib/errors";
import type { UserRole } from "@/domain/roles";

export async function GET(request: Request) {
  try {
    await ensureAdminApi();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const pagination = parsePaginationParams(searchParams);
    const members = await teamService.list({
      search,
      ...(pagination && {
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    });
    return jsonListResponse(members);
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    await ensureAdminApi();
    const body = await request.json();
    const parsed = createTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const member = await teamService.create({
      ...parsed.data,
      role: parsed.data.role as UserRole,
    });
    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
