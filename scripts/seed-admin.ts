/**
 * Create default admin user.
 * Usage: npm run seed:admin
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { authService } = await import("../src/services/auth.service");
  const { ensureIndexes } = await import("../src/repositories/indexes");

  await connectDb();
  await ensureIndexes();

  const email = process.env.ADMIN_EMAIL ?? "admin@inventory.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const name = process.env.ADMIN_NAME ?? "Admin";

  const user = await authService.ensureAdminUser(email, password, name);
  console.log(`Admin ready: ${user.email} (${user._id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
