import type { Purchase, Supplier, SupplierStats } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { PurchaseModel } from "@/models/purchase.model";
import { SupplierModel } from "@/models/supplier.model";

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
      { contactPerson: { $regex: q, $options: "i" } },
      { phone: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
      { address: { $regex: q, $options: "i" } },
    ];
  }
  return filter;
}

export const supplierRepository = {
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
  ): Promise<PaginatedResult<Supplier>> {
    const filter = buildFilter(businessId, options);
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      SupplierModel.find(filter)
        .sort(mongoSort(options.sort ?? "name", options.dir ?? "asc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      SupplierModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Supplier);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async findByBusiness(
    businessId: string,
    options?: { search?: string; activeOnly?: boolean }
  ): Promise<Supplier[]> {
    const filter = buildFilter(businessId, options);
    const docs = await SupplierModel.find(filter)
      .sort({ name: 1 })
      .lean();
    return docs.map((doc) => mapId(doc) as Supplier);
  },

  async findById(id: string): Promise<Supplier | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await SupplierModel.findById(oid).lean();
    return doc ? (mapId(doc) as Supplier) : null;
  },

  async create(
    data: Omit<Supplier, "_id" | "createdAt" | "updatedAt" | "isActive"> & {
      isActive?: boolean;
    }
  ): Promise<Supplier> {
    const doc = await SupplierModel.create({
      ...data,
      name: data.name.trim(),
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      contactPerson: data.contactPerson?.trim() || undefined,
      address: data.address?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      isActive: data.isActive ?? true,
      updatedAt: new Date(),
    });
    return mapId(doc.toObject()) as Supplier;
  },

  async update(
    id: string,
    data: Partial<
      Omit<Supplier, "_id" | "businessId" | "createdAt" | "updatedAt">
    >
  ): Promise<Supplier | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.contactPerson !== undefined) {
      patch.contactPerson = data.contactPerson.trim() || undefined;
    }
    if (data.phone !== undefined) patch.phone = data.phone.trim() || undefined;
    if (data.email !== undefined) patch.email = data.email.trim() || undefined;
    if (data.address !== undefined) {
      patch.address = data.address.trim() || undefined;
    }
    if (data.notes !== undefined) patch.notes = data.notes.trim() || undefined;
    if (data.isActive !== undefined) patch.isActive = data.isActive;

    const doc = await SupplierModel.findByIdAndUpdate(
      oid,
      { $set: patch },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Supplier) : null;
  },

  async getStats(businessId: string, supplierId: string): Promise<SupplierStats> {
    const name = await this.getName(supplierId);
    const match: Record<string, unknown> = {
      businessId,
      $or: [{ supplierId }, ...(name ? [{ supplierName: name }] : [])],
    };

    const [agg] = await PurchaseModel.aggregate<{
      count: number;
      total: number;
      lastPurchaseAt?: Date;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: "$total" },
          lastPurchaseAt: { $max: "$createdAt" },
        },
      },
    ]);

    return {
      purchaseCount: agg?.count ?? 0,
      purchaseTotal: agg?.total ?? 0,
      lastPurchaseAt: agg?.lastPurchaseAt,
    };
  },

  async getName(id: string): Promise<string | null> {
    const supplier = await this.findById(id);
    return supplier?.name ?? null;
  },

  async findPurchasesPaginated(
    businessId: string,
    supplierId: string,
    options: { page: number; pageSize: number }
  ): Promise<PaginatedResult<Purchase>> {
    const name = await this.getName(supplierId);
    const filter: Record<string, unknown> = {
      businessId,
      $or: [{ supplierId }, ...(name ? [{ supplierName: name }] : [])],
    };
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      PurchaseModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      PurchaseModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Purchase);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },
};
