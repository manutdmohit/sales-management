import type { BusinessType, Product, ProductKind } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { ProductModel } from "@/models/product.model";

function toProduct(doc: Record<string, unknown>): Product {
  const mapped = mapId(doc as { _id: unknown }) as unknown as Product;
  return {
    ...mapped,
    businessType: (doc.businessType as BusinessType | undefined) ?? "GENERAL",
    productKind: (doc.productKind as ProductKind | undefined) ?? "FINISHED",
    recipe: doc.recipe as Product["recipe"],
  };
}

function buildProductFilter(
  businessId: string,
  options?: {
    search?: string;
    activeOnly?: boolean;
    productKind?: ProductKind;
    categoryId?: string;
    uncategorized?: boolean;
  }
): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [{ businessId }];
  if (options?.activeOnly !== false) clauses.push({ isActive: true });

  if (options?.categoryId) {
    clauses.push({ categoryId: options.categoryId });
  } else if (options?.uncategorized) {
    clauses.push({
      $or: [{ categoryId: { $exists: false } }, { categoryId: null }, { categoryId: "" }],
    });
  }

  if (options?.productKind === "RAW") {
    clauses.push({ productKind: "RAW" });
  } else if (options?.productKind === "FINISHED") {
    clauses.push({
      $or: [
        { productKind: "FINISHED" },
        { productKind: { $exists: false } },
      ],
    });
  }

  if (options?.search) {
    const term = options.search;
    clauses.push({
      $or: [
        { name: { $regex: term, $options: "i" } },
        { sku: { $regex: term, $options: "i" } },
      ],
    });
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

export const productRepository = {
  async findByBusiness(
    businessId: string,
    options?: {
      search?: string;
      activeOnly?: boolean;
      productKind?: ProductKind;
      categoryId?: string;
      uncategorized?: boolean;
    }
  ): Promise<Product[]> {
    const filter = buildProductFilter(businessId, options);
    const docs = await ProductModel.find(filter).sort({ name: 1 }).lean();
    return docs.map((doc) => toProduct(doc as Record<string, unknown>));
  },

  async findByBusinessPaginated(
    businessId: string,
    options: {
      search?: string;
      activeOnly?: boolean;
      productKind?: ProductKind;
      categoryId?: string;
      uncategorized?: boolean;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<Product>> {
    const filter = buildProductFilter(businessId, options);
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      ProductModel.find(filter)
        .sort(mongoSort(options.sort ?? "name", options.dir ?? "asc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      ProductModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) =>
      toProduct(doc as Record<string, unknown>)
    );
    return buildPaginatedResult(
      items,
      total,
      options.page,
      options.pageSize
    );
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
    data: Partial<Omit<Product, "_id" | "businessId" | "createdAt">> & {
      categoryId?: string | null;
    }
  ): Promise<Product | null> {
    const oid = toObjectId(id);
    if (!oid) return null;

    const setFields: Record<string, unknown> = { updatedAt: new Date() };
    const unsetFields: Record<string, 1> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (key === "categoryId" && value === null) {
        unsetFields.categoryId = 1;
        continue;
      }
      setFields[key] = value;
    }

    const updateQuery: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) {
      updateQuery.$unset = unsetFields;
    }

    const doc = await ProductModel.findByIdAndUpdate(oid, updateQuery, {
      new: true,
    }).lean();
    return doc ? toProduct(doc as Record<string, unknown>) : null;
  },
};
