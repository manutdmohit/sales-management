/**
 * Backfill product unit costs from production history and sale COGS fields.
 *
 * Usage: npm run backfill:product-costs
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { ProductModel } from "../src/models/product.model";
import { ProductionRunModel } from "../src/models/production-run.model";
import { SaleModel } from "../src/models/sale.model";
import {
  lineCostFromUnitCost,
  weightedAverageUnitCost,
} from "../src/lib/inventory-cost";

export type ProductCostsBackfillResult = {
  productsFromProduction: number;
  productsFromPurchase: number;
  salesUpdated: number;
};

async function backfillFinishedProductCosts(): Promise<number> {
  const runs = await ProductionRunModel.find({
    unitMaterialCost: { $exists: true, $gt: 0 },
  })
    .sort({ createdAt: 1 })
    .lean();

  const byProduct = new Map<
    string,
    { stock: number; unitCost: number }
  >();

  for (const run of runs) {
    const productId = String(run.finishedProductId);
    let state = byProduct.get(productId);
    if (!state) {
      const product = await ProductModel.findById(productId).lean();
      if (!product) continue;
      state = {
        stock: 0,
        unitCost: product.pricing?.unitCost ?? product.pricing?.purchase ?? 0,
      };
      byProduct.set(productId, state);
    }

    state.unitCost = weightedAverageUnitCost(
      state.stock,
      state.unitCost,
      run.quantityProduced as number,
      run.unitMaterialCost as number
    );
    state.stock += run.quantityProduced as number;
  }

  for (const [productId, state] of byProduct) {
    await ProductModel.updateOne(
      { _id: productId },
      {
        $set: {
          "pricing.unitCost": state.unitCost,
          updatedAt: new Date(),
        },
      }
    );
  }

  return byProduct.size;
}

async function backfillPurchaseUnitCosts(): Promise<number> {
  const products = await ProductModel.find({
    $or: [{ "pricing.unitCost": { $exists: false } }, { "pricing.unitCost": null }],
  }).lean();

  let updated = 0;
  for (const product of products) {
    const purchase = product.pricing?.purchase ?? 0;
    if (purchase <= 0) continue;
    await ProductModel.updateOne(
      { _id: product._id },
      { $set: { "pricing.unitCost": purchase, updatedAt: new Date() } }
    );
    updated += 1;
  }

  return updated;
}

async function backfillSaleCogs(): Promise<number> {
  const sales = await SaleModel.find({
    $or: [
      { totalCost: { $exists: false } },
      { "items.lineCost": { $exists: false } },
    ],
  }).lean();

  const productCache = new Map<
    string,
    { purchase: number; unitCost?: number } | null
  >();

  let updated = 0;
  for (const sale of sales) {
    let totalCost = 0;
    const items = [];

    for (const item of sale.items) {
      const productId = String(item.productId);
      let pricing = productCache.get(productId);
      if (pricing === undefined) {
        const product = await ProductModel.findById(productId).lean();
        pricing = product?.pricing
          ? {
              purchase: product.pricing.purchase ?? 0,
              unitCost: product.pricing.unitCost,
            }
          : null;
        productCache.set(productId, pricing);
      }
      const unitCost = pricing?.unitCost ?? pricing?.purchase ?? 0;
      const lineCost = lineCostFromUnitCost(unitCost, item.quantity);
      totalCost += lineCost;
      items.push({
        ...item,
        unitCost,
        lineCost,
      });
    }

    await SaleModel.updateOne(
      { _id: sale._id },
      { $set: { items, totalCost } }
    );
    updated += 1;
  }

  return updated;
}

export async function backfillProductCosts(): Promise<ProductCostsBackfillResult> {
  const productsFromProduction = await backfillFinishedProductCosts();
  const productsFromPurchase = await backfillPurchaseUnitCosts();
  const salesUpdated = await backfillSaleCogs();
  return { productsFromProduction, productsFromPurchase, salesUpdated };
}

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");

  await connectDb();
  await ensureIndexes();

  const result = await backfillProductCosts();
  console.log(
    `Updated unit cost on ${result.productsFromProduction} finished product(s) from production runs.`
  );
  console.log(
    `Set unit cost from purchase price on ${result.productsFromPurchase} product(s).`
  );
  console.log(`Backfilled COGS on ${result.salesUpdated} sale(s).`);
  process.exit(0);
}

if (process.argv[1]?.includes("backfill-product-costs")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
