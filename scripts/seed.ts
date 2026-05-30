/**
 * Seed demo businesses, products, and a purchase (stock in).
 * Usage: npm run seed
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  const base = process.env.SEED_BASE_URL ?? "http://localhost:3000";

  const businesses = [
    {
      name: "Magic Touch",
      slug: "magic-touch",
      code: "MT",
      type: "SALON",
    },
    { name: "Vedic", slug: "vedic", code: "VED", type: "RETAIL" },
    { name: "Pharmacy", slug: "pharmacy", code: "PHM", type: "PHARMACY" },
  ];

  const created: { id: string; code: string; type: string }[] = [];

  for (const b of businesses) {
    const res = await fetch(`${base}/api/businesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...b, isActive: true, settings: { currency: "INR" } }),
    });
    const json = await res.json();
    if (res.ok) {
      created.push({ id: json.data._id, code: b.code, type: b.type });
      console.log(`Created business: ${b.name}`);
    } else if (json.code === "DUPLICATE_SLUG") {
      const list = await fetch(`${base}/api/businesses`).then((r) => r.json());
      const found = list.data?.find((x: { slug: string }) => x.slug === b.slug);
      if (found)
        created.push({
          id: found._id,
          code: b.code,
          type: found.type ?? b.type,
        });
      console.log(`Business exists: ${b.name}`);
    } else {
      console.error(`Failed ${b.name}:`, json);
    }
  }

  const pharmacy = created.find((c) => c.code === "PHM");
  if (!pharmacy) {
    console.error("Pharmacy business required for product seed");
    process.exit(1);
  }

  const products = [
    {
      name: "Paracetamol 500mg",
      slug: "paracetamol-500",
      sku: "PAR-500",
      pricing: { purchase: 12, selling: 18 },
      trackExpiry: true,
      minStock: 50,
    },
    {
      name: "Hand Sanitizer 100ml",
      slug: "sanitizer-100",
      sku: "HS-100",
      pricing: { purchase: 25, selling: 40 },
      trackExpiry: false,
      minStock: 20,
    },
  ];

  const productIds: string[] = [];

  for (const p of products) {
    const res = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: pharmacy.id,
        businessType: pharmacy.type,
        ...p,
        isActive: true,
      }),
    });
    const json = await res.json();
    if (res.ok) {
      productIds.push(json.data._id);
      console.log(`Created product: ${p.name}`);
    } else {
      console.warn(`Product ${p.sku}:`, json.error ?? json);
    }
  }

  if (productIds.length > 0) {
    const res = await fetch(`${base}/api/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: pharmacy.id,
        supplierName: "Demo Supplier",
        items: [
          {
            productId: productIds[0],
            quantity: 100,
            unitCost: 12,
            batchNumber: "BATCH-001",
            expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
          },
          {
            productId: productIds[1] ?? productIds[0],
            quantity: 50,
            unitCost: 25,
          },
        ],
      }),
    });
    const json = await res.json();
    if (res.ok) {
      console.log(`Created purchase: ${json.data._id}`);
    } else {
      console.warn("Purchase seed:", json);
    }
  }

  console.log("\nSeed complete. Open http://localhost:3000 and select Pharmacy.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
