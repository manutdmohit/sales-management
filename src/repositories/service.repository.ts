import type { Service } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { ServiceModel } from "@/models/service.model";

function buildFilter(
  businessId: string,
  options?: { search?: string; activeOnly?: boolean }
): Record<string, unknown> {
  const filter: Record<string, unknown> = { businessId };
  if (options?.activeOnly !== false) filter.isActive = true;
  if (options?.search) {
    filter.$or = [
      { name: { $regex: options.search, $options: "i" } },
      { category: { $regex: options.search, $options: "i" } },
    ];
  }
  return filter;
}

export const serviceRepository = {
  async findByBusiness(
    businessId: string,
    options?: { search?: string; activeOnly?: boolean }
  ): Promise<Service[]> {
    const filter = buildFilter(businessId, options);
    const docs = await ServiceModel.find(filter).sort({ name: 1 }).lean();
    return docs.map((doc) => mapId(doc) as Service);
  },

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
  ): Promise<PaginatedResult<Service>> {
    const filter = buildFilter(businessId, options);
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      ServiceModel.find(filter)
        .sort(mongoSort(options.sort ?? "name", options.dir ?? "asc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      ServiceModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Service);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async findById(id: string): Promise<Service | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ServiceModel.findById(oid).lean();
    return doc ? (mapId(doc) as Service) : null;
  },

  async create(
    data: Omit<Service, "_id" | "createdAt" | "updatedAt">
  ): Promise<Service> {
    const doc = await ServiceModel.create(data);
    return mapId(doc.toObject()) as Service;
  },

  async update(
    id: string,
    data: Partial<Omit<Service, "_id" | "businessId" | "createdAt">>
  ): Promise<Service | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await ServiceModel.findByIdAndUpdate(
      oid,
      { $set: { ...data, updatedAt: new Date() } },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Service) : null;
  },
};
