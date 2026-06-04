/**
 * Run scheduled jobs locally or from CI (reminders + expiry alerts).
 *
 * Usage:
 *   npm run reminders
 *
 * Requires MONGODB_URI and CRON_SECRET (or pass via header when hitting the API).
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");
  const { reminderService } = await import("../src/services/reminder.service");
  const { expiryService } = await import("../src/services/expiry.service");

  await connectDb();
  await ensureIndexes();

  const [reminders, expiry] = await Promise.all([
    reminderService.runDueReminders(),
    expiryService.runExpiryAlerts(),
  ]);
  console.log(JSON.stringify({ reminders, expiry }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
