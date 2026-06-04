/**
 * Backfill client records from existing sales.
 *
 * Sales created before sale→client linking existed only stored an embedded
 * customer (name/phone). This creates/links a Client record for each of them so
 * the customer's full purchase history shows up under the Clients module.
 *
 * Usage: npm run backfill:clients
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");
  const { clientService } = await import("../src/services/client.service");

  await connectDb();
  await ensureIndexes();

  const { clientsLinked, salesUpdated } = await clientService.backfillFromSales();

  console.log(
    `Backfill complete — ${clientsLinked} client(s) ensured, ${salesUpdated} sale(s) linked.`
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
