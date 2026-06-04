/**
 * Seed the two companies this system manages, with sample data:
 *   - Vedic        → Manufacturing (raw materials + finished goods + recipes)
 *   - Magic Touch  → Service & retail (creams + salon services)
 *
 * Writes directly to MongoDB (no HTTP/auth needed).
 * Usage: npm run seed
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

type Doc = { _id: unknown };

type SeedProduct = {
  name: string;
  slug: string;
  sku: string;
  unitId?: string;
  pricing: { purchase: number; selling: number };
  minStock: number;
  productKind?: "RAW" | "FINISHED";
  categorySlug?: string;
  recipe?: {
    rawSku: string;
    quantityPerUnit: number;
  }[];
  trackExpiry?: boolean;
};

type SeedCategory = {
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
};

async function main() {
  const { connectDb } = await import("../src/lib/db");
  const { ensureIndexes } = await import("../src/repositories/indexes");
  const { BusinessModel } = await import("../src/models/business.model");
  const { ProductModel } = await import("../src/models/product.model");
  const { ProductCategoryModel } = await import(
    "../src/models/product-category.model"
  );
  const { ServiceModel } = await import("../src/models/service.model");
  const { ClientModel } = await import("../src/models/client.model");

  await connectDb();
  await ensureIndexes();

  const companies = [
    { name: "Vedic", slug: "vedic", code: "VED", type: "MANUFACTURER" },
    {
      name: "Magic Touch",
      slug: "magic-touch",
      code: "MT",
      type: "SERVICE_RETAIL",
    },
  ] as const;

  const bySlug: Record<string, Doc> = {};
  for (const c of companies) {
    const settings =
      c.slug === "magic-touch"
        ? {
            currency: "NPR",
            logoUrl: "/images/logo/magic-touch-logo.jpg",
            address: "Tushal, Boudha (in front of Taragaon Museum)",
          }
        : { currency: "NPR" };

    const doc = await BusinessModel.findOneAndUpdate(
      { slug: c.slug },
      {
        $set: {
          name: c.name,
          code: c.code,
          type: c.type,
          isActive: true,
          settings,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    bySlug[c.slug] = doc as Doc;
    console.log(`Business ready: ${c.name} (${c.type})`);
  }

  const vedicId = String(bySlug["vedic"]._id);
  const magicId = String(bySlug["magic-touch"]._id);

  async function seedCategories(
    businessId: string,
    categories: SeedCategory[]
  ): Promise<Map<string, string>> {
    const idBySlug = new Map<string, string>();
    for (const c of categories) {
      const doc = await ProductCategoryModel.findOneAndUpdate(
        { businessId, slug: c.slug },
        {
          $set: {
            businessId,
            name: c.name,
            slug: c.slug,
            description: c.description,
            sortOrder: c.sortOrder,
            isActive: true,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      idBySlug.set(c.slug, String(doc._id));
      console.log(`  Category ready: ${c.name}`);
    }
    return idBySlug;
  }

  async function seedProducts(
    businessId: string,
    businessType: string,
    products: SeedProduct[],
    categoryIdBySlug: Map<string, string> = new Map()
  ) {
    const idBySku = new Map<string, string>();

    for (const p of products) {
      const categoryId = p.categorySlug
        ? categoryIdBySlug.get(p.categorySlug)
        : undefined;
      const doc = await ProductModel.findOneAndUpdate(
        { businessId, sku: p.sku },
        {
          $set: {
            businessId,
            businessType,
            productKind: p.productKind ?? "FINISHED",
            name: p.name,
            slug: p.slug,
            sku: p.sku,
            unitId: p.unitId ?? (p.productKind === "RAW" ? "kg" : "pack"),
            pricing: { ...p.pricing, unitCost: p.pricing.purchase },
            trackExpiry: p.trackExpiry ?? false,
            minStock: p.minStock,
            isActive: true,
            updatedAt: new Date(),
            ...(categoryId ? { categoryId } : {}),
            ...(p.productKind === "RAW" ? { recipe: undefined } : {}),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      idBySku.set(p.sku, String(doc._id));
      console.log(`  Product ready: ${p.name}`);
    }

    for (const p of products) {
      if (!p.recipe?.length) continue;
      const recipe = p.recipe.map((line) => {
        const rawProductId = idBySku.get(line.rawSku);
        if (!rawProductId) {
          throw new Error(`Recipe references unknown SKU ${line.rawSku}`);
        }
        const raw = products.find((x) => x.sku === line.rawSku);
        return {
          rawProductId,
          rawProductName: raw?.name,
          rawUnitId: raw?.unitId ?? "kg",
          quantityPerUnit: line.quantityPerUnit,
        };
      });
      await ProductModel.updateOne(
        { businessId, sku: p.sku },
        { $set: { recipe, updatedAt: new Date() } }
      );
      console.log(`  Recipe set: ${p.name}`);
    }
  }

  console.log("\nVedic categories…");
  const vedicCategories = await seedCategories(vedicId, [
    {
      name: "Raw materials",
      slug: "raw-materials",
      description: "Ingredients used in production",
      sortOrder: 0,
    },
    {
      name: "Biscuits & cookies",
      slug: "biscuits",
      description: "Finished baked goods",
      sortOrder: 1,
    },
    {
      name: "Noodles",
      slug: "noodles",
      description: "Instant noodle products",
      sortOrder: 2,
    },
  ]);

  console.log("\nVedic products…");
  await seedProducts(vedicId, "MANUFACTURER", [
    {
      name: "Wheat Flour",
      slug: "wheat-flour",
      sku: "VED-FLR",
      productKind: "RAW",
      categorySlug: "raw-materials",
      unitId: "kg",
      pricing: { purchase: 40, selling: 0 },
      minStock: 500,
      trackExpiry: true,
    },
    {
      name: "Sugar",
      slug: "sugar",
      sku: "VED-SGR",
      productKind: "RAW",
      categorySlug: "raw-materials",
      unitId: "kg",
      pricing: { purchase: 55, selling: 0 },
      minStock: 200,
      trackExpiry: true,
    },
    {
      name: "Cocoa Powder",
      slug: "cocoa-powder",
      sku: "VED-CCO",
      productKind: "RAW",
      categorySlug: "raw-materials",
      unitId: "kg",
      pricing: { purchase: 120, selling: 0 },
      minStock: 50,
      trackExpiry: true,
    },
    {
      name: "Noodle Mix",
      slug: "noodle-mix",
      sku: "VED-NMX",
      productKind: "RAW",
      categorySlug: "raw-materials",
      unitId: "kg",
      pricing: { purchase: 25, selling: 0 },
      minStock: 300,
      trackExpiry: true,
    },
    {
      name: "Choco Cookies 200g",
      slug: "choco-cookies-200",
      sku: "VED-CKE-200",
      productKind: "FINISHED",
      categorySlug: "biscuits",
      unitId: "pack",
      pricing: { purchase: 30, selling: 50 },
      minStock: 100,
      trackExpiry: true,
      recipe: [
        { rawSku: "VED-FLR", quantityPerUnit: 0.12 },
        { rawSku: "VED-SGR", quantityPerUnit: 0.05 },
        { rawSku: "VED-CCO", quantityPerUnit: 0.02 },
      ],
    },
    {
      name: "Instant Noodles 75g",
      slug: "instant-noodles-75",
      sku: "VED-NDL-75",
      productKind: "FINISHED",
      categorySlug: "noodles",
      unitId: "pack",
      pricing: { purchase: 12, selling: 20 },
      minStock: 200,
      trackExpiry: true,
      recipe: [{ rawSku: "VED-NMX", quantityPerUnit: 0.075 }],
    },
  ], vedicCategories);

  console.log("\nMagic Touch categories…");
  const magicCategories = await seedCategories(magicId, [
    {
      name: "Skincare",
      slug: "skincare",
      description: "Face and skin products",
      sortOrder: 0,
    },
    {
      name: "Body care",
      slug: "body-care",
      description: "Hand and body creams",
      sortOrder: 1,
    },
  ]);

  console.log("\nMagic Touch products…");
  await seedProducts(magicId, "SERVICE_RETAIL", [
    {
      name: "Face Cream 50ml",
      slug: "face-cream-50",
      sku: "MT-FC-50",
      categorySlug: "skincare",
      unitId: "piece",
      pricing: { purchase: 120, selling: 220 },
      minStock: 20,
    },
    {
      name: "Hand Cream 75ml",
      slug: "hand-cream-75",
      sku: "MT-HC-75",
      categorySlug: "body-care",
      unitId: "piece",
      pricing: { purchase: 80, selling: 150 },
      minStock: 20,
    },
  ], magicCategories);

  const services = [
    { name: "Facial", category: "Skincare", price: 800, durationMinutes: 45 },
    { name: "Haircut", category: "Hair", price: 300, durationMinutes: 30 },
    { name: "Hair Spa", category: "Hair", price: 1200, durationMinutes: 60 },
  ];
  for (const s of services) {
    await ServiceModel.findOneAndUpdate(
      { businessId: magicId, name: s.name },
      {
        $set: {
          businessId: magicId,
          name: s.name,
          category: s.category,
          price: s.price,
          durationMinutes: s.durationMinutes,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    );
    console.log(`  Service ready: ${s.name}`);
  }

  type SeedClient = { name: string; phone: string; email?: string; address?: string };

  async function seedClients(businessId: string, clients: SeedClient[]) {
    for (const c of clients) {
      await ClientModel.findOneAndUpdate(
        { businessId, phone: c.phone },
        {
          $set: {
            businessId,
            name: c.name,
            phone: c.phone,
            email: c.email,
            address: c.address,
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, new: true }
      );
      console.log(`  Client ready: ${c.name}`);
    }
  }

  console.log("\nVedic clients…");
  await seedClients(vedicId, [
    {
      name: "Kathmandu Mart",
      phone: "9841111001",
      email: "orders@kathmandumart.np",
      address: "Kalimati, Kathmandu",
    },
    {
      name: "Himalayan Foods Pvt Ltd",
      phone: "9841111002",
      email: "wholesale@himalayanfoods.np",
    },
    {
      name: "Boudha Wholesale",
      phone: "9841111003",
      address: "Boudha, Kathmandu",
    },
    {
      name: "Valley Department Store",
      phone: "9841111004",
    },
  ]);

  console.log("\nMagic Touch clients…");
  await seedClients(magicId, [
    {
      name: "Sita Sharma",
      phone: "9812345678",
      email: "sita.sharma@example.com",
    },
    {
      name: "Anita Gurung",
      phone: "9823456789",
    },
    {
      name: "Priya Thapa",
      phone: "9834567890",
      email: "priya.t@example.com",
    },
  ]);

  const { backfillAndSeedVedicProduction } = await import(
    "./backfill-production"
  );
  console.log("\nVedic production history…");
  const production = await backfillAndSeedVedicProduction();
  console.log(
    `  ${production.costsBackfilled} run(s) cost-backfilled, ${production.demoRunsCreated} demo run(s) seeded`
  );

  const { seedVedicBatchExpiry } = await import("./backfill-vedic-batches");
  console.log("\nVedic batch expiry (purchases + output lots)…");
  const batches = await seedVedicBatchExpiry();
  console.log(
    `  ${batches.productsUpdated} product(s) expiry-enabled, purchase ${batches.purchaseCreated ? "created" : "skipped"}, ${batches.outputBatchesCreated} output batch(es) linked`
  );

  const { backfillProductCosts } = await import("./backfill-product-costs");
  console.log("\nProduct unit costs & sale COGS…");
  const costs = await backfillProductCosts();
  console.log(
    `  ${costs.productsFromProduction} product(s) from production, ${costs.productsFromPurchase} from purchase price, ${costs.salesUpdated} sale(s) COGS backfilled`
  );

  console.log(
    "\nSeed complete. Open the app and switch between Vedic (Manufacturing) and Magic Touch (Service & retail) in the header."
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
