import type { Sale } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import { normalizeMongoWeekKey } from "@/lib/report-ranges";
import { SaleModel } from "@/models/sale.model";

export const saleRepository = {
  async findByBusiness(
    businessId: string,
    limit = 50
  ): Promise<Sale[]> {
    const docs = await SaleModel.find({ businessId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return docs.map((doc) => mapId(doc) as Sale);
  },

  async create(data: Omit<Sale, "_id">): Promise<Sale> {
    const doc = await SaleModel.create(data);
    return mapId(doc.toObject()) as Sale;
  },

  async countByBusiness(businessId: string): Promise<number> {
    return SaleModel.countDocuments({ businessId });
  },

  async aggregateReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<{ key: string; count: number; total: number }[]> {
    const rows = await SaleModel.aggregate<{
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
