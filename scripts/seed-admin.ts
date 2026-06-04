/**
 * Create default admin and staff users.
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

  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@inventory.local";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  const staffEmail = process.env.STAFF_EMAIL ?? "staff@inventory.local";
  const staffPassword = process.env.STAFF_PASSWORD ?? "staff123";
  const staffName = process.env.STAFF_NAME ?? "Staff";

  const admin = await authService.ensureAdminUser(
    adminEmail,
    adminPassword,
    adminName
  );
  const staff = await authService.ensureStaffUser(
    staffEmail,
    staffPassword,
    staffName
  );

  console.log(`Admin ready: ${admin.email} (${admin._id}) — full access`);
  console.log(`Staff ready: ${staff.email} (${staff._id}) — POS + bookings only`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
