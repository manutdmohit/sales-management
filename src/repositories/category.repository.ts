import type { ProductCategory } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { ProductCategoryModel } from "@/models/product-category.model";
import { ProductModel } from "@/models/product.model";

function buildFilter(
  businessId: string,
  options?: { search?: string; activeOnly?: boolean }
): Record<string, unknown> {
  const filter: Record<string, unknown> = { businessId };
  if (options?.activeOnly !== false) filter.isActive = true;
  if (options?.search?.trim()) {
    const q = options.search.trim();
    filter.$or = [
      { name: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  return filter;
}

export const categoryRepository = {
  async findByBusinessPaginated(
    businessId: string,
    options: {
      search?: string;
      activeOnly?: boolean;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<ProductCategory>> {
    const filter = buildFilter(businessId, options);
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      ProductCategoryModel.find(filter)
        .sort(
          mongoSort(options.sort ?? "sortOrder", options.dir ?? "asc", {
            sortOrder: 1,
            name: 1,
          })
        )
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      ProductCategoryModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as ProductCategory);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async findByBusiness(
    businessId: string,
    options?: { search?: string; activeOnly?: boolean }
  ): Promise<ProductCategory[]> {
    const filter = buildFilter(businessId, options);
    const docs = await ProductCategoryModel.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();
    return docs.map((doc) => mapId(doc) as ProductCategory);
  },

  async findById(id: string): Promise<ProductCategory | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ProductCategoryModel.findById(oid).lean();
    return doc ? (mapId(doc) as ProductCategory) : null;
  },

  async create(
    data: Omit<ProductCategory, "_id" | "createdAt" | "updatedAt">
  ): Promise<ProductCategory> {
    const doc = await ProductCategoryModel.create(data);
    return mapId(doc.toObject()) as ProductCategory;
  },

  async update(
    id: string,
    data: Partial<Omit<ProductCategory, "_id" | "businessId" | "createdAt">>
  ): Promise<ProductCategory | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ProductCategoryModel.findByIdAndUpdate(
      oid,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as ProductCategory) : null;
  },

  async countProducts(businessId: string, categoryId: string): Promise<number> {
    return ProductModel.countDocuments({
      businessId,
      categoryId,
      isActive: true,
    });
  },
};
