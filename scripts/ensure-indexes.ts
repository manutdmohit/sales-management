/**
 * Sync MongoDB indexes (run after deploy or schema changes).
 * Usage: npm run db:indexes
 */
import { config } from "dotenv";
import { resolve } from "path";
import mongoose from "mongoose";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { ensureIndexes } = await import("../src/repositories/indexes");
  await ensureIndexes();
  console.log("Database indexes synced.");
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") &&
      String(process.env.MONGODB_URI ?? "").startsWith("mongodb+srv://")
    ) {
      console.error(
        "\nCould not resolve MongoDB Atlas SRV host. Try:\n" +
          "  1. Run the command again (db.ts now uses public DNS for SRV URIs).\n" +
          "  2. Set Windows DNS to 8.8.8.8 or 1.1.1.1.\n" +
          "  3. Use a standard mongodb:// URI in MONGODB_URI instead of mongodb+srv.\n"
      );
    }
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
