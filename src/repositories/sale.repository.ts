import type { Sale } from "@/domain/types";
import { mapId, toObjectId } from "@/lib/map-document";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { normalizeMongoWeekKey, mongoGroupDateId } from "@/lib/report-ranges";
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

  async findByBusinessPaginated(
    businessId: string,
    options: {
      page: number;
      pageSize: number;
      search?: string;
      sort?: string;
      dir?: SortDir;
    }
  ): Promise<PaginatedResult<Sale>> {
    const { page, pageSize, search } = options;
    const filter: Record<string, unknown> = { businessId };
    if (search?.trim()) {
      const term = search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: term, $options: "i" } },
        { "customer.name": { $regex: term, $options: "i" } },
        { "customer.phone": { $regex: term, $options: "i" } },
      ];
    }
    const skip = (page - 1) * pageSize;
    const [docs, total] = await Promise.all([
      SaleModel.find(filter)
        .sort(
          mongoSort(options.sort ?? "createdAt", options.dir ?? "desc", {
            createdAt: -1,
          })
        )
        .skip(skip)
        .limit(pageSize)
        .lean(),
      SaleModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Sale);
    return buildPaginatedResult(items, total, page, pageSize);
  },

  async findById(id: string): Promise<Sale | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await SaleModel.findById(oid).lean();
    return doc ? (mapId(doc) as Sale) : null;
  },

  async create(data: Omit<Sale, "_id">): Promise<Sale> {
    const doc = await SaleModel.create(data);
    return mapId(doc.toObject()) as Sale;
  },

  async update(
    id: string,
    data: Partial<Omit<Sale, "_id" | "businessId">>
  ): Promise<Sale | null> {
    const oid = toObjectId(id);
    if (!oid) return null;
    const doc = await SaleModel.findByIdAndUpdate(
      oid,
      { $set: data },
      { new: true }
    ).lean();
    return doc ? (mapId(doc) as Sale) : null;
  },

  /** Paginated credit sales. When `outstandingOnly`, excludes fully-paid ones. */
  async findReceivablesPaginated(
    businessId: string,
    options: {
      outstandingOnly?: boolean;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<Sale>> {
    const filter: Record<string, unknown> = {
      businessId,
      saleType: "CREDIT",
    };
    if (options.outstandingOnly) {
      filter.creditStatus = { $in: ["PENDING", "PARTIAL"] };
    }
    if (options.search?.trim()) {
      const term = options.search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: term, $options: "i" } },
        { "customer.name": { $regex: term, $options: "i" } },
        { "customer.phone": { $regex: term, $options: "i" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      SaleModel.find(filter)
        .sort(
          options.sort
            ? mongoSort(options.sort, options.dir ?? "asc", { createdAt: -1 })
            : { dueDate: 1, createdAt: -1 }
        )
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      SaleModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) => mapId(doc) as Sale);
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async countByBusiness(businessId: string): Promise<number> {
    return SaleModel.countDocuments({ businessId });
  },

  /** All sales that captured a customer phone — used to backfill client links. */
  async findWithCustomerPhone(businessId?: string): Promise<Sale[]> {
    const filter: Record<string, unknown> = {
      "customer.phone": { $exists: true, $ne: "" },
    };
    if (businessId) filter.businessId = businessId;
    const docs = await SaleModel.find(filter).lean();
    return docs.map((doc) => mapId(doc) as Sale);
  },

  async setClientId(saleId: string, clientId: string): Promise<void> {
    const oid = toObjectId(saleId);
    if (!oid) return;
    await SaleModel.updateOne({ _id: oid }, { $set: { clientId } });
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
    const docs = await SaleModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
    })
      .select(
        "createdAt items.productName items.quantity items.lineTotal customer.name"
      )
      .lean();
    return docs.map((doc) => ({
      createdAt: doc.createdAt as Date,
      items: doc.items.map(
        (item: {
          productName: string;
          quantity: number;
          lineTotal: number;
        }) => ({
          productName: item.productName,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })
      ),
      partyName: doc.customer?.name?.trim() || "Walk-in",
    }));
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
          _id: mongoGroupDateId(dateFormat),
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

  async aggregateGrossProfitReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<
    { key: string; count: number; revenue: number; cost: number; total: number }[]
  > {
    const rows = await SaleModel.aggregate<{
      _id: string;
      count: number;
      revenue: number;
      cost: number;
    }>([
      {
        $match: {
          businessId,
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: mongoGroupDateId(dateFormat),
          count: { $sum: 1 },
          revenue: { $sum: "$subtotal" },
          cost: { $sum: { $ifNull: ["$totalCost", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return rows.map((r) => ({
      key: normalizeMongoWeekKey(String(r._id)),
      count: r.count,
      revenue: r.revenue,
      cost: r.cost,
      total: r.revenue - r.cost,
    }));
  },

  async aggregateProfitTotals(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<{ revenue: number; cost: number; count: number }> {
    const rows = await SaleModel.aggregate<{
      revenue: number;
      cost: number;
      count: number;
    }>([
      {
        $match: {
          businessId,
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$subtotal" },
          cost: { $sum: { $ifNull: ["$totalCost", 0] } },
          count: { $sum: 1 },
        },
      },
    ]);
    const row = rows[0];
    return {
      revenue: row?.revenue ?? 0,
      cost: row?.cost ?? 0,
      count: row?.count ?? 0,
    };
  },

  async findForGrossProfitDetails(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<
    {
      createdAt: Date;
      items: {
        productName: string;
        quantity: number;
        lineTotal: number;
        lineCost?: number;
      }[];
      partyName: string;
    }[]
  > {
    const docs = await SaleModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
    })
      .select(
        "createdAt items.productName items.quantity items.lineTotal items.lineCost customer.name"
      )
      .lean();
    return docs.map((doc) => ({
      createdAt: doc.createdAt as Date,
      items: doc.items.map(
        (item: {
          productName: string;
          quantity: number;
          lineTotal: number;
          lineCost?: number;
        }) => ({
          productName: item.productName,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          lineCost: item.lineCost,
        })
      ),
      partyName: doc.customer?.name?.trim() || "Walk-in",
    }));
  },

  /**
   * Aggregates collected payments by method within a date range. Works off the
   * `payments[]` ledger so it reflects actual cash flow — including down-payments
   * and later credit settlements on the date each was collected.
   */
  async aggregatePaymentMethods(
    businessId: string,
    from: Date,
    to: Date
  ): Promise<{ method: string; amount: number; count: number }[]> {
    const rows = await SaleModel.aggregate<{
      _id: string;
      amount: number;
      count: number;
    }>([
      { $match: { businessId } },
      { $unwind: "$payments" },
      { $match: { "payments.at": { $gte: from, $lte: to } } },
      {
        $group: {
          _id: "$payments.method",
          amount: { $sum: "$payments.amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    return rows.map((r) => ({
      method: String(r._id ?? "CASH"),
      amount: r.amount,
      count: r.count,
    }));
  },

  /** Outstanding credit sales with dueDate in [from, end] (all businesses). */
  async findCreditDueBetween(from: Date, to: Date): Promise<Sale[]> {
    const docs = await SaleModel.find({
      saleType: "CREDIT",
      creditStatus: { $in: ["PENDING", "PARTIAL"] },
      amountDue: { $gt: 0 },
      dueDate: { $gte: from, $lte: to },
    }).lean();
    return docs.map((doc) => mapId(doc) as Sale);
  },
};
