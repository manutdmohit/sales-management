import type { Purchase } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import { normalizeMongoWeekKey } from "@/lib/report-ranges";
import { PurchaseModel } from "@/models/purchase.model";

export const purchaseRepository = {
  async findByBusiness(
    businessId: string,
    limit = 50
  ): Promise<Purchase[]> {
    const docs = await PurchaseModel.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc) => mapId(doc) as Purchase);
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
