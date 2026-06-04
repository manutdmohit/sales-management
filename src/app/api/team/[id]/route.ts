import { NextResponse } from "next/server";
import { updateTeamMemberSchema } from "@/schemas/team.schema";
import { teamService } from "@/services/team.service";
import { ensureAdminApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";
import type { UserRole } from "@/domain/roles";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await ensureAdminApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const member = await teamService.update(
      id,
      {
        ...parsed.data,
        role: parsed.data.role as UserRole | undefined,
      },
      session.sub
    );
    return NextResponse.json({ data: member });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await ensureAdminApi();
    const { id } = await params;
    const member = await teamService.setActive(id, false, session.sub);
    return NextResponse.json({ data: member });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
