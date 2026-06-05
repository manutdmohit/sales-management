import type { ProductionRun } from "@/domain/types";
import { mapId } from "@/lib/map-document";
import { normalizeMongoWeekKey } from "@/lib/report-ranges";
import {
  buildPaginatedResult,
  mongoSort,
  type PaginatedResult,
  type SortDir,
} from "@/lib/pagination";
import { ProductionRunModel } from "@/models/production-run.model";

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeProductionRun(doc: { _id: unknown } & Record<string, unknown>): ProductionRun {
  const run = mapId(doc) as unknown as ProductionRun;
  return {
    ...run,
    quantityProduced: toFiniteNumber(run.quantityProduced) ?? 0,
    recipeSnapshot: Array.isArray(run.recipeSnapshot) ? run.recipeSnapshot : [],
    materialsSnapshot: Array.isArray(run.materialsSnapshot)
      ? run.materialsSnapshot.map((line) => ({
          ...line,
          quantityConsumed: toFiniteNumber(line.quantityConsumed) ?? 0,
          unitCost: toFiniteNumber(line.unitCost) ?? 0,
          lineCost: toFiniteNumber(line.lineCost) ?? 0,
        }))
      : [],
    totalMaterialCost: toFiniteNumber(run.totalMaterialCost),
    unitMaterialCost: toFiniteNumber(run.unitMaterialCost),
  };
}

export const productionRunRepository = {
  async findByBusinessPaginated(
    businessId: string,
    options: {
      search?: string;
      sort?: string;
      dir?: SortDir;
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedResult<ProductionRun>> {
    const filter: Record<string, unknown> = { businessId };
    if (options.search?.trim()) {
      const term = options.search.trim();
      filter.$or = [
        { finishedProductName: { $regex: term, $options: "i" } },
        { notes: { $regex: term, $options: "i" } },
      ];
    }
    const skip = (options.page - 1) * options.pageSize;
    const [docs, total] = await Promise.all([
      ProductionRunModel.find(filter)
        .sort(mongoSort(options.sort ?? "createdAt", options.dir ?? "desc"))
        .skip(skip)
        .limit(options.pageSize)
        .lean(),
      ProductionRunModel.countDocuments(filter),
    ]);
    const items = docs.map((doc) =>
      normalizeProductionRun(doc as { _id: unknown } & Record<string, unknown>)
    );
    return buildPaginatedResult(items, total, options.page, options.pageSize);
  },

  async create(
    data: Omit<ProductionRun, "_id">
  ): Promise<ProductionRun> {
    const doc = await ProductionRunModel.create(data);
    return normalizeProductionRun(
      doc.toObject() as { _id: unknown } & Record<string, unknown>
    );
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
    const docs = await ProductionRunModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
    })
      .select("createdAt finishedProductName quantityProduced notes")
      .lean();

    return docs.map((doc) => ({
      createdAt: doc.createdAt as Date,
      items: [
        {
          productName: doc.finishedProductName as string,
          quantity: doc.quantityProduced as number,
          lineTotal: doc.quantityProduced as number,
        },
      ],
      partyName: (doc.notes as string | undefined)?.trim() || "Production run",
    }));
  },

  async aggregateReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<{ key: string; count: number; total: number }[]> {
    const rows = await ProductionRunModel.aggregate<{
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
          total: { $sum: "$quantityProduced" },
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

  async findForRawConsumptionDetails(
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
    const docs = await ProductionRunModel.find({
      businessId,
      createdAt: { $gte: from, $lte: to },
      "materialsSnapshot.0": { $exists: true },
    })
      .select("createdAt finishedProductName materialsSnapshot")
      .lean();

    const rows: {
      createdAt: Date;
      items: { productName: string; quantity: number; lineTotal: number }[];
      partyName: string;
    }[] = [];

    for (const doc of docs) {
      const materials = doc.materialsSnapshot as {
        rawProductName?: string;
        quantityConsumed: number;
        lineCost: number;
      }[];
      for (const line of materials) {
        rows.push({
          createdAt: doc.createdAt as Date,
          items: [
            {
              productName: line.rawProductName ?? "Raw material",
              quantity: line.quantityConsumed,
              lineTotal: line.lineCost,
            },
          ],
          partyName: `→ ${doc.finishedProductName as string}`,
        });
      }
    }

    return rows;
  },

  async aggregateRawConsumptionReport(
    businessId: string,
    from: Date,
    to: Date,
    dateFormat: string
  ): Promise<{ key: string; count: number; total: number }[]> {
    const rows = await ProductionRunModel.aggregate<{
      _id: string;
      count: number;
      total: number;
    }>([
      {
        $match: {
          businessId,
          createdAt: { $gte: from, $lte: to },
          "materialsSnapshot.0": { $exists: true },
        },
      },
      { $unwind: "$materialsSnapshot" },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: "$createdAt" },
          },
          count: { $sum: 1 },
          total: { $sum: "$materialsSnapshot.lineCost" },
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
