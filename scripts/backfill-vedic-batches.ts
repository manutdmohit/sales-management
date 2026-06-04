/**
 * Enable batch expiry for Vedic demo data:
 * - Turn on trackExpiry for all Vedic products
 * - Seed raw-material purchases with batch + expiry lots
 * - Backfill output batches on existing production runs
 *
 * Usage: npm run backfill:vedic-batches
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const DEMO_PURCHASE_REF = "[demo] GRN-001 — raw materials";

function daysFromToday(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

type DemoRunBatch = {
  batchNumber: string;
  expiryDaysFromToday: number;
};

const OUTPUT_BATCH_BY_NOTES: Record<string, DemoRunBatch> = {
  "[demo] Week 2 cookies batch": {
    batchNumber: "CKE-W2-001",
    expiryDaysFromToday: 22,
  },
  "[demo] Mid-month cookie refill": {
    batchNumber: "CKE-MM-001",
    expiryDaysFromToday: 45,
  },
  "[demo] Noodle run — line A": {
    batchNumber: "NDL-A-001",
    expiryDaysFromToday: 14,
  },
  "[demo] Large cookie batch": {
    batchNumber: "CKE-LG-001",
    expiryDaysFromToday: -5,
  },
  "[demo] Noodle weekend run": {
    batchNumber: "NDL-WK-001",
    expiryDaysFromToday: 28,
  },
  "[demo] Cookies — morning shift": {
    batchNumber: "CKE-AM-001",
    expiryDaysFromToday: 60,
  },
};

export async function seedVedicBatchExpiry(): Promise<{
  productsUpdated: number;
  purchaseCreated: boolean;
  outputBatchesCreated: number;
  outputBatchesSkipped: number;
}> {
  const { BusinessModel } = await import("../src/models/business.model");
  const { ProductModel } = await import("../src/models/product.model");
  const { PurchaseModel } = await import("../src/models/purchase.model");
  const { SupplierModel } = await import("../src/models/supplier.model");
  const { ProductionRunModel } = await import("../src/models/production-run.model");
  const { InventoryTransactionModel } = await import(
    "../src/models/inventory-transaction.model"
  );
  const { BatchModel } = await import("../src/models/batch.model");
  const { purchaseService } = await import("../src/services/purchase.service");
  const { expiryService } = await import("../src/services/expiry.service");
  const { mapId } = await import("../src/lib/map-document");

  const vedic = await BusinessModel.findOne({ slug: "vedic" }).lean();
  if (!vedic) {
    console.log("Vedic business not found — skip batch expiry seed.");
    return {
      productsUpdated: 0,
      purchaseCreated: false,
      outputBatchesCreated: 0,
      outputBatchesSkipped: 0,
    };
  }

  const businessId = String(vedic._id);

  const productUpdate = await ProductModel.updateMany(
    { businessId },
    { $set: { trackExpiry: true, updatedAt: new Date() } }
  );
  const productsUpdated = productUpdate.modifiedCount;

  const products = await ProductModel.find({ businessId }).lean();
  const productBySku = new Map(products.map((p) => [p.sku, mapId(p)]));

  let purchaseCreated = false;
  const existingPurchase = await PurchaseModel.findOne({
    businessId,
    referenceNumber: DEMO_PURCHASE_REF,
  }).lean();

  if (!existingPurchase) {
    let supplier = await SupplierModel.findOne({
      businessId,
      name: "Himalayan Grain Suppliers",
    }).lean();

    if (!supplier) {
      supplier = (
        await SupplierModel.create({
          businessId,
          name: "Himalayan Grain Suppliers",
          contactPerson: "Ramesh Thapa",
          phone: "9841200100",
          email: "supply@himalayangrain.np",
          address: "Bhairahawa, Rupandehi",
          isActive: true,
        })
      ).toObject();
      console.log("  Supplier ready: Himalayan Grain Suppliers");
    }

    const supplierId = String(supplier._id);
    const lines = [
      {
        sku: "VED-FLR",
        quantity: 1200,
        batchNumber: "FLR-LOT-A",
        expiryDaysFromToday: 180,
      },
      {
        sku: "VED-FLR",
        quantity: 200,
        batchNumber: "FLR-LOT-B",
        expiryDaysFromToday: 12,
      },
      {
        sku: "VED-SGR",
        quantity: 600,
        batchNumber: "SGR-LOT-A",
        expiryDaysFromToday: 365,
      },
      {
        sku: "VED-CCO",
        quantity: 120,
        batchNumber: "CCO-LOT-A",
        expiryDaysFromToday: 90,
      },
      {
        sku: "VED-NMX",
        quantity: 900,
        batchNumber: "NMX-LOT-A",
        expiryDaysFromToday: 150,
      },
    ] as const;

    const items = lines.map((line) => {
      const product = productBySku.get(line.sku);
      if (!product) {
        throw new Error(`Product ${line.sku} not found for batch purchase seed`);
      }
      return {
        productId: product._id,
        quantity: line.quantity,
        unitCost: product.pricing.purchase,
        batchNumber: line.batchNumber,
        expiryDate: daysFromToday(line.expiryDaysFromToday),
      };
    });

    await purchaseService.create({
      businessId,
      supplierId,
      referenceNumber: DEMO_PURCHASE_REF,
      tax: 0,
      items,
    });
    purchaseCreated = true;
    console.log(`  Purchase ready: ${DEMO_PURCHASE_REF}`);
  } else {
    console.log(`  Purchase already present: ${DEMO_PURCHASE_REF}`);
  }

  let outputBatchesCreated = 0;
  let outputBatchesSkipped = 0;

  const runs = await ProductionRunModel.find({ businessId }).lean();
  for (const run of runs) {
    const finishedDoc = products.find(
      (p) => String(p._id) === run.finishedProductId
    );
    if (!finishedDoc?.trackExpiry) continue;

    const runId = String(run._id);
    const outputTx = await InventoryTransactionModel.findOne({
      businessId,
      referenceId: runId,
      type: "PRODUCTION_OUTPUT",
    }).lean();

    if (!outputTx) continue;
    if (outputTx.batchId) {
      outputBatchesSkipped++;
      continue;
    }

    const meta =
      (run.notes && OUTPUT_BATCH_BY_NOTES[run.notes]) ?? {
        batchNumber: `PR-${finishedDoc.sku}-${runId.slice(-6).toUpperCase()}`,
        expiryDaysFromToday: 90,
      };

    const batch = await BatchModel.create({
      businessId,
      productId: run.finishedProductId,
      batchNumber: meta.batchNumber,
      expiryDate: daysFromToday(meta.expiryDaysFromToday),
      quantity: run.quantityProduced,
      remainingQuantity: run.quantityProduced,
    });

    await InventoryTransactionModel.updateOne(
      { _id: outputTx._id },
      { $set: { batchId: String(batch._id) } }
    );

    outputBatchesCreated++;
    console.log(
      `  Output batch: ${meta.batchNumber} — ${run.finishedProductName} × ${run.quantityProduced}`
    );
  }

  await expiryService.ensureExpiryNotifications(businessId);

  return {
    productsUpdated,
    purchaseCreated,
    outputBatchesCreated,
    outputBatchesSkipped,
  };
}

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");

  await connectDb();
  await ensureIndexes();

  const result = await seedVedicBatchExpiry();

  console.log(
    `\nVedic batch expiry seed complete — ${result.productsUpdated} product(s) flagged, purchase ${result.purchaseCreated ? "created" : "skipped"}, ${result.outputBatchesCreated} output batch(es) created, ${result.outputBatchesSkipped} already linked.`
  );
}

if (process.argv[1]?.includes("backfill-vedic-batches")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
