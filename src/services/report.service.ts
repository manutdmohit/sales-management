import type { ReportPeriod, ReportResult } from "@/lib/report-ranges";
import {
  bucketLabel,
  iterateBucketKeys,
  mongoDateFormat,
  resolveReportRange,
} from "@/lib/report-ranges";
import { purchaseRepository } from "@/repositories/purchase.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { businessService } from "./business.service";
import type { ReportQuery } from "@/schemas/report.schema";

export const reportService = {
  async getReport(query: ReportQuery): Promise<ReportResult> {
    await businessService.getById(query.businessId);

    const { from, to } = resolveReportRange(
      query.period,
      query.from,
      query.to
    );
    const dateFormat = mongoDateFormat(query.period);

    const rows =
      query.kind === "sales"
        ? await saleRepository.aggregateReport(
            query.businessId,
            from,
            to,
            dateFormat
          )
        : await purchaseRepository.aggregateReport(
            query.businessId,
            from,
            to,
            dateFormat
          );

    const rowMap = new Map(rows.map((r) => [r.key, r]));
    const keys = iterateBucketKeys(from, to, query.period);

    const buckets = keys.map((key) => {
      const row = rowMap.get(key);
      return {
        label: bucketLabel(key, query.period),
        date: key,
        count: row?.count ?? 0,
        total: row?.total ?? 0,
      };
    });

    const totalCount = buckets.reduce((a, b) => a + b.count, 0);
    const totalAmount = buckets.reduce((a, b) => a + b.total, 0);

    return {
      kind: query.kind,
      period: query.period as ReportPeriod,
      from: from.toISOString(),
      to: to.toISOString(),
      buckets,
      totalCount,
      totalAmount,
    };
  },
};
