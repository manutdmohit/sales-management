/**
 * Export MongoDB collections to JSON files.
 *
 * Usage:
 *   npm run export:db
 *   npm run export:db -- --out ./my-backup
 *   npm run export:db -- --collections sales,clients,products
 *
 * By default writes to exports/<timestamp>/ and strips passwordHash from users.
 */
import { mkdir, writeFile } from "fs/promises";
import dns from "node:dns";
import { resolve } from "path";
import { config } from "dotenv";
import mongoose from "mongoose";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// Some local DNS resolvers fail Atlas SRV lookups (querySrv ECONNREFUSED).
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);

const COLLECTIONS = [
  "businesses",
  "products",
  "product_categories",
  "clients",
  "suppliers",
  "sales",
  "purchases",
  "appointments",
  "services",
  "inventory_transactions",
  "batches",
  "production_runs",
  "users",
  "notifications",
  "app_settings",
  "reminder_dispatches",
] as const;

function serialize(value: unknown): unknown {
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        serialize(entry),
      ])
    );
  }
  return value;
}

function sanitizeUsers(docs: Record<string, unknown>[]) {
  return docs.map((doc) => {
    const copy = { ...doc };
    delete copy.passwordHash;
    return copy;
  });
}

function parseArgs(argv: string[]) {
  let outDir = "";
  let collections: string[] | null = null;
  let keepPasswords = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out" && argv[i + 1]) {
      outDir = argv[++i];
    } else if (arg === "--collections" && argv[i + 1]) {
      collections = argv[++i]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    } else if (arg === "--keep-passwords") {
      keepPasswords = true;
    }
  }

  return { outDir, collections, keepPasswords };
}

async function main() {
  const { outDir, collections, keepPasswords } = parseArgs(process.argv.slice(2));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = resolve(
    process.cwd(),
    outDir || `exports/${timestamp}`
  );

  const selected = collections ?? [...COLLECTIONS];

  const { connectDb } = await import("../src/lib/db");
  await connectDb();

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("Database connection is not ready");
  }

  await mkdir(targetDir, { recursive: true });

  const existing = new Set(
    (await db.listCollections().toArray()).map((c) => c.name)
  );

  const manifest: {
    exportedAt: string;
    database: string;
    collections: { name: string; count: number; file: string }[];
  } = {
    exportedAt: new Date().toISOString(),
    database: db.databaseName,
    collections: [],
  };

  for (const name of selected) {
    if (!existing.has(name)) {
      console.log(`Skipping ${name} (collection not found)`);
      continue;
    }

    const docs = await db.collection(name).find({}).toArray();
    let serialized = docs.map((doc) =>
      serialize(doc)
    ) as Record<string, unknown>[];

    if (name === "users" && !keepPasswords) {
      serialized = sanitizeUsers(serialized);
    }

    const fileName = `${name}.json`;
    const filePath = resolve(targetDir, fileName);
    await writeFile(filePath, JSON.stringify(serialized, null, 2), "utf8");

    manifest.collections.push({
      name,
      count: serialized.length,
      file: fileName,
    });

    console.log(`Exported ${name}: ${serialized.length} document(s)`);
  }

  await writeFile(
    resolve(targetDir, "_manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8"
  );

  console.log(`\nDone. Files written to ${targetDir}`);
  if (!keepPasswords) {
    console.log("Note: passwordHash was removed from users.json");
  }
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
        "\nCould not resolve MongoDB Atlas SRV host. Try one of:\n" +
          "  1. Run export again (this script now uses public DNS).\n" +
          "  2. Set Windows DNS to 8.8.8.8 or 1.1.1.1.\n" +
          "  3. In Atlas → Connect → Drivers, copy the standard mongodb:// URI\n" +
          "     (not mongodb+srv) into MONGODB_URI in .env.\n"
      );
    }
    console.error(error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
