import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { toErrorResponse } from "@/lib/errors";
import { ensureIndexes } from "@/repositories/indexes";
import { reminderService } from "@/services/reminder.service";
import { expiryService } from "@/services/expiry.service";

/** Allow time for MongoDB + email on Vercel (Pro: up to 300s; Hobby: capped at 10s). */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret === secret) return true;

  const { searchParams } = new URL(request.url);
  return searchParams.get("secret") === secret;
}

/**
 * Daily scheduled job — credit/follow-up reminders and batch expiry alerts.
 *
 * Scheduled via vercel.json (00:15 UTC ≈ 6:00 AM Asia/Kathmandu).
 * Set CRON_SECRET in Vercel — the platform sends Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  return runReminders(request);
}

export async function POST(request: Request) {
  return runReminders(request);
}

async function runReminders(request: Request) {
  try {
    if (!authorizeCron(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDb();
    await ensureIndexes();

    const [reminders, expiry] = await Promise.all([
      reminderService.runDueReminders(),
      expiryService.runExpiryAlerts(),
    ]);
    return NextResponse.json({ data: { reminders, expiry } });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
