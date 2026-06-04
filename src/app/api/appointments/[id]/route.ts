import { NextResponse } from "next/server";
import { updateAppointmentSchema } from "@/schemas/appointment.schema";
import { appointmentService } from "@/services/appointment.service";
import { ensureProtectedApi } from "@/lib/api";
import { toErrorResponse } from "@/lib/errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await ensureProtectedApi();
    const { id } = await params;
    const appointment = await appointmentService.getById(id);
    return NextResponse.json({ data: appointment });
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
    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const appointment = await appointmentService.update(id, parsed.data);
    return NextResponse.json({ data: appointment });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
