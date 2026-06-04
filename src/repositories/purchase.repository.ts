import type { Purchase } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { normalizeMongoWeekKey } from "@/lib/report-ranges";
import { PurchaseModel } from "@/models/purchase.model";

export const purchaseRepository = {
  async findByBusiness(businessId: string): Promise<Purchase[]> {
    const docs = await PurchaseModel.find({ businessId })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => mapId(doc) as Purchase);
  },

  async findByBusinessPaginated(
    businessId: string,
    options: {
      page: number;
      pageSize: number;
      search?: string;
      sort?: string;
      dir?: SortDir;
    }
  ): Promise<PaginatedResult<Purchase>> {
    const { page, pageSize, search } = options;
    const filter: Record<string, unknown> = { businessId };
    if (search?.trim()) {
      filter.$or = [
        { supplierName: { $regex: search.trim(), $options: "i" } },
        { referenceNumber: { $regex: search.trim(), $options: "i" } },
      ];
    }
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      PurchaseModel.find(filter)
        .sort(mongoSort(options.sort ?? "createdAt", options.dir ?? "desc"))
        .skip(skip)
        .limit(pageSize)
        .lean(),
      PurchaseModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Purchase);
    return buildPaginatedResult(items, total, page, pageSize);
  },

  async create(data: Omit<Purchase, "_id">): Promise<Purchase> {
    const doc = await PurchaseModel.create(data);
    return mapId(doc.toObject()) as Purchase;
  },

  async findById(id: string): Promise<Purchase | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await PurchaseModel.findById(oid).lean();
    return doc ? (mapId(doc) as Purchase) : null;
  },

  async update(
    id: string,
    data: Partial<Omit<Purchase, "_id" | "businessId" | "createdAt">>
  ): Promise<Purchase | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await PurchaseModel.findByIdAndUpdate(
      oid,
      { $set: data },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Purchase) : null;
  },

  async findForReportDetails(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<
    {
      createdAt: Date;
      items: { productName: string; quantity: number; lineTotal: number }[];
      partyName: string;
    }[]
  > {
    const docs = await PurchaseModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
    })
      .select(
        "createdAt items.productName items.quantity supplierName items.unitCost"
      )
      .lean();
    return docs.map((doc) => ({
      createdAt: doc.createdAt as Date,
      items: doc.items.map(
        (item: {
          productName: string;
          quantity: number;
          unitCost: number;
        }) => ({
          productName: item.productName,
          quantity: item.quantity,
          lineTotal: item.quantity * item.unitCost,
        })
      ),
      partyName: doc.supplierName?.trim() || "Unknown supplier",
    }));
  },

  async aggregateReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<{ key: string; count: number; total: number }[]> {
    const rows = await PurchaseModel.aggregate<{
      _id: string;
      count: number;
      total: number;
    }>([
      {
        $match: {
          businessId,
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          count: { $sum: 1 },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({
      key: normalizeMongoWeekKey(String(r._id)),
      count: r.count,
      total: r.total,
    }));
  },
};
