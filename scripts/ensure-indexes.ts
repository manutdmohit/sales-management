/**
 * Sync MongoDB indexes (run after deploy or schema changes).
 * Usage: npm run db:indexes
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { ensureIndexes } = await import("../src/repositories/indexes");
  await ensureIndexes();
  console.log("Database indexes synced.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
