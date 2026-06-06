import { NextResponse } from "next/server";
import { updateTeamPasswordSchema } from "@/schemas/team.schema";
import { teamService } from "@/services/team.service";
import { ensureAdminApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await ensureAdminApi();
    const { id } = await params;
    const body = await request.json();
    const parsed = updateTeamPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const member = await teamService.updatePassword(
      id,
      parsed.data.password,
      session.sub
    );
    return NextResponse.json({ data: member });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
