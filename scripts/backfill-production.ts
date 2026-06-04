/**
 * Backfill production run costs and seed demo Vedic production history.
 *
 * 1. Updates existing runs missing materialsSnapshot / costs (from recipe + purchase prices).
 * 2. Inserts demo production runs (idempotent via [demo] notes) with inventory ledger entries.
 *
 * Usage: npm run backfill:production
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import type { Product } from "../src/domain/types";

type ProductDoc = {
  _id: unknown;
  sku: string;
  name: string;
  unitId?: string;
  productKind?: string;
  recipe?: {
    rawProductId: string;
    rawProductName?: string;
    rawUnitId?: string;
    quantityPerUnit: number;
  }[];
  pricing: { purchase: number; selling: number };
};

type RunDoc = {
  _id: unknown;
  businessId: string;
  finishedProductId: string;
  finishedProductName: string;
  finishedUnitId?: string;
  quantityProduced: number;
  recipeSnapshot: ProductDoc["recipe"];
  materialsSnapshot?: unknown[];
  notes?: string;
  createdAt?: Date;
};

const DEMO_RUNS = [
  {
    finishedSku: "VED-CKE-200",
    quantityProduced: 50,
    daysAgo: 14,
    notes: "[demo] Week 2 cookies batch",
  },
  {
    finishedSku: "VED-CKE-200",
    quantityProduced: 80,
    daysAgo: 10,
    notes: "[demo] Mid-month cookie refill",
  },
  {
    finishedSku: "VED-NDL-75",
    quantityProduced: 150,
    daysAgo: 7,
    notes: "[demo] Noodle run — line A",
  },
  {
    finishedSku: "VED-CKE-200",
    quantityProduced: 100,
    daysAgo: 5,
    notes: "[demo] Large cookie batch",
  },
  {
    finishedSku: "VED-NDL-75",
    quantityProduced: 200,
    daysAgo: 3,
    notes: "[demo] Noodle weekend run",
  },
  {
    finishedSku: "VED-CKE-200",
    quantityProduced: 60,
    daysAgo: 1,
    notes: "[demo] Cookies — morning shift",
  },
] as const;

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 30, 0, 0);
  return d;
}

export async function backfillAndSeedVedicProduction(): Promise<{
  costsBackfilled: number;
  demoRunsCreated: number;
  demoRunsSkipped: number;
}> {
  const { BusinessModel } = await import("../src/models/business.model");
  const { ProductModel } = await import("../src/models/product.model");
  const { ProductionRunModel } = await import("../src/models/production-run.model");
  const { InventoryTransactionModel } = await import(
    "../src/models/inventory-transaction.model"
  );
  const {
    buildMaterialsSnapshot,
    unitMaterialCost,
  } = await import("../src/lib/production-cost");
  const { mapId } = await import("../src/lib/map-document");

  const vedic = await BusinessModel.findOne({ slug: "vedic" }).lean();
  if (!vedic) {
    console.log("Vedic business not found — skip production backfill.");
    return { costsBackfilled: 0, demoRunsCreated: 0, demoRunsSkipped: 0 };
  }

  const businessId = String(vedic._id);
  const productDocs = (await ProductModel.find({ businessId }).lean()) as ProductDoc[];
  const productsById = new Map<string, Product>(
    productDocs.map((p) => [String(p._id), mapId(p) as Product])
  );
  const productBySku = new Map(productDocs.map((p) => [p.sku, p]));

  let costsBackfilled = 0;
  const runs = (await ProductionRunModel.find({ businessId }).lean()) as RunDoc[];

  for (const run of runs) {
    if (run.materialsSnapshot && run.materialsSnapshot.length > 0) continue;
    if (!run.recipeSnapshot?.length) continue;

    const requirements = run.recipeSnapshot.map((line) => ({
      rawProductId: line.rawProductId,
      rawProductName: line.rawProductName,
      rawUnitId: line.rawUnitId,
      quantityRequired: line.quantityPerUnit * run.quantityProduced,
    }));

    const { materials, totalMaterialCost } = buildMaterialsSnapshot(
      requirements,
      productsById
    );

    await ProductionRunModel.updateOne(
      { _id: run._id },
      {
        $set: {
          materialsSnapshot: materials,
          totalMaterialCost,
          unitMaterialCost: unitMaterialCost(
            totalMaterialCost,
            run.quantityProduced
          ),
        },
      }
    );
    costsBackfilled++;
    console.log(
      `  Cost backfill: ${run.finishedProductName} × ${run.quantityProduced} → ${totalMaterialCost.toFixed(2)}`
    );
  }

  let demoRunsCreated = 0;
  let demoRunsSkipped = 0;

  for (const demo of DEMO_RUNS) {
    const existing = await ProductionRunModel.findOne({
      businessId,
      notes: demo.notes,
    }).lean();
    if (existing) {
      demoRunsSkipped++;
      continue;
    }

    const finished = productBySku.get(demo.finishedSku);
    if (!finished?.recipe?.length) {
      console.warn(`  Skip demo — product ${demo.finishedSku} not found or has no recipe`);
      continue;
    }

    const recipeSnapshot = finished.recipe.map((line) => ({ ...line }));
    const requirements = recipeSnapshot.map((line) => ({
      rawProductId: line.rawProductId,
      rawProductName: line.rawProductName,
      rawUnitId: line.rawUnitId,
      quantityRequired: line.quantityPerUnit * demo.quantityProduced,
    }));

    const { materials, totalMaterialCost } = buildMaterialsSnapshot(
      requirements,
      productsById
    );

    const createdAt = daysAgoDate(demo.daysAgo);
    const run = await ProductionRunModel.create({
      businessId,
      finishedProductId: String(finished._id),
      finishedProductName: finished.name,
      finishedUnitId: finished.unitId,
      quantityProduced: demo.quantityProduced,
      recipeSnapshot,
      materialsSnapshot: materials,
      totalMaterialCost,
      unitMaterialCost: unitMaterialCost(
        totalMaterialCost,
        demo.quantityProduced
      ),
      notes: demo.notes,
      createdAt,
    });

    const runId = String(run._id);
    const txDocs = [
      ...requirements.map((req) => ({
        businessId,
        productId: req.rawProductId,
        type: "PRODUCTION_CONSUME" as const,
        quantity: req.quantityRequired,
        referenceId: runId,
        notes: demo.notes,
        timestamp: createdAt,
      })),
      {
        businessId,
        productId: String(finished._id),
        type: "PRODUCTION_OUTPUT" as const,
        quantity: demo.quantityProduced,
        referenceId: runId,
        notes: demo.notes,
        timestamp: createdAt,
      },
    ];

    await InventoryTransactionModel.insertMany(txDocs);
    demoRunsCreated++;
    console.log(
      `  Demo run: ${finished.name} × ${demo.quantityProduced} (${demo.notes}) — cost ${totalMaterialCost.toFixed(2)}`
    );
  }

  return { costsBackfilled, demoRunsCreated, demoRunsSkipped };
}

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");

  await connectDb();
  await ensureIndexes();

  const result = await backfillAndSeedVedicProduction();

  console.log(
    `\nProduction backfill complete — ${result.costsBackfilled} run(s) cost-updated, ${result.demoRunsCreated} demo run(s) created, ${result.demoRunsSkipped} demo run(s) already present.`
  );
}

if (process.argv[1]?.includes("backfill-production")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
