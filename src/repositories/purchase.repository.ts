import type { Purchase } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  type PaginatedResult,
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
    page: number,
    pageSize: number
  ): Promise<PaginatedResult<Purchase>> {
    const filter = { businessId };
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      PurchaseModel.find(filter)
        .sort({ createdAt: -1 })
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
