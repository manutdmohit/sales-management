import type { BusinessType, Product } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import { ProductModel } from "@/models/product.model";

function toProduct(doc: Record<string, unknown>): Product {
  const mapped = mapId(doc as { _id: unknown }) as unknown as Product;
  return {
    ...mapped,
    businessType: (doc.businessType as BusinessType | undefined) ?? "GENERAL",
  };
}

export const productRepository = {
  async findByBusiness(
    businessId: string,
    options?: { search?: string; activeOnly?: boolean }
  ): Promise<Product[]> {
    const filter: Record<string, unknown> = { businessId };
    if (options?.activeOnly !== false) filter.isActive = true;
    if (options?.search) {
      filter.$or = [
        { name: { $regex: options.search, $options: "i" } },
        { sku: { $regex: options.search, $options: "i" } },
      ];
    }
    const docs = await ProductModel.find(filter).sort({ name: 1 }).lean();
    return docs.map((doc) => toProduct(doc as Record<string, unknown>));
  },

  async findById(id: string): Promise<Product | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ProductModel.findById(oid).lean();
    return doc ? toProduct(doc as Record<string, unknown>) : null;
  },

  async create(
    data: Omit<Product, "_id" | "createdAt" | "updatedAt">
  ): Promise<Product> {
    const doc = await ProductModel.create(data);
    return toProduct(doc.toObject() as Record<string, unknown>);
  },

  async syncBusinessType(
    businessId: string,
    businessType: BusinessType
  ): Promise<void> {
    await ProductModel.updateMany({ businessId }, { $set: { businessType } });
  },

  async update(
    id: string,
    data: Partial<Omit<Product, "_id" | "businessId" | "createdAt">>
  ): Promise<Product | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ProductModel.findByIdAndUpdate(
      oid,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return doc ? toProduct(doc as Record<string, unknown>) : null;
  },
};
