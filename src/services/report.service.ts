import type {
  PaymentMethodBreakdown,
  ReportPeriod,
  ReportResult,
} from "@/lib/report-ranges";
import {
  bucketKeyForDate,
  bucketLabel,
  mergeBucketKeys,
  mongoDateFormat,
  resolveReportRange,
  type ReportLineDetail,
} from "@/lib/report-ranges";
import { hasFeature } from "@/domain/capabilities";
import { AppError } from "@/lib/errors";
import { appointmentRepository } from "@/repositories/appointment.repository";
import { productionRunRepository } from "@/repositories/production-run.repository";
import { purchaseRepository } from "@/repositories/purchase.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { businessService } from "./business.service";
import type { ReportQuery } from "@/schemas/report.schema";

type DetailRow = {
  createdAt: Date;
  items: {
    productName: string;
    quantity: number;
    lineTotal: number;
    lineCost?: number;
  }[];
  partyName: string;
};

function buildDetailsByKey(
  detailRows: DetailRow[],
  period: ReportPeriod
): Map<string, ReportLineDetail[]> {
  const detailsByKey = new Map<string, ReportLineDetail[]>();
  for (const row of detailRows) {
    const key = bucketKeyForDate(new Date(row.createdAt), period);
    const list = detailsByKey.get(key) ?? [];
    for (const item of row.items) {
      list.push({
        productName: item.productName,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        lineCost: item.lineCost,
        partyName: row.partyName,
      });
    }
    detailsByKey.set(key, list);
  }
  return detailsByKey;
}

function paymentBreakdownFromRows(
  rows: { method: string; amount: number; count: number }[]
): { paymentBreakdown: PaymentMethodBreakdown[]; totalCollected: number } {
  const byMethod = new Map(rows.map((r) => [r.method, r]));
  const paymentBreakdown = (["CASH", "ONLINE"] as const).map((method) => ({
    method,
    amount: byMethod.get(method)?.amount ?? 0,
    count: byMethod.get(method)?.count ?? 0,
  }));
  const totalCollected = paymentBreakdown.reduce((a, b) => a + b.amount, 0);
  return { paymentBreakdown, totalCollected };
}

export const reportService = {
  async getReport(query: ReportQuery): Promise<ReportResult> {
    const business = await businessService.getById(query.businessId);

    if (query.kind === "services" && !hasFeature(business.type, "services")) {
      throw new AppError(
        "Service reports are not available for this business",
        400,
        "INVALID_REPORT_KIND"
      );
    }

    if (
      (query.kind === "production" || query.kind === "rawConsumption") &&
      !hasFeature(business.type, "manufacturing")
    ) {
      throw new AppError(
        "Production reports are not available for this business",
        400,
        "INVALID_REPORT_KIND"
      );
    }

    const { from, to } = resolveReportRange(
      query.period,
      query.from,
      query.to
    );

    if (query.kind === "profit") {
      return this.getProfitReport(
        query.businessId,
        from,
        to,
        query.period as ReportPeriod,
        hasFeature(business.type, "services")
      );
    }

    const dateFormat = mongoDateFormat(query.period);

    const rows =
      query.kind === "sales"
        ? await saleRepository.aggregateReport(
            query.businessId,
            from,
            to,
            dateFormat
          )
        : query.kind === "purchases"
          ? await purchaseRepository.aggregateReport(
              query.businessId,
              from,
              to,
              dateFormat
            )
          : query.kind === "services"
            ? await appointmentRepository.aggregateReport(
                query.businessId,
                from,
                to,
                dateFormat
              )
            : query.kind === "rawConsumption"
              ? await productionRunRepository.aggregateRawConsumptionReport(
                  query.businessId,
                  from,
                  to,
                  dateFormat
                )
              : await productionRunRepository.aggregateReport(
                  query.businessId,
                  from,
                  to,
                  dateFormat
                );

    const rowMap = new Map(
      rows.map((r) => [
        r.key,
        r as {
          key: string;
          count: number;
          total: number;
          revenue?: number;
          cost?: number;
        },
      ])
    );
    const keys = mergeBucketKeys(
      from,
      to,
      query.period,
      rows.map((r) => r.key)
    );

    const detailRows: DetailRow[] =
      query.kind === "sales"
        ? await saleRepository.findForReportDetails(
            query.businessId,
            from,
            to
          )
        : query.kind === "purchases"
          ? await purchaseRepository.findForReportDetails(
              query.businessId,
              from,
              to
            )
          : query.kind === "services"
            ? await appointmentRepository.findForReportDetails(
                query.businessId,
                from,
                to
              )
            : query.kind === "rawConsumption"
              ? await productionRunRepository.findForRawConsumptionDetails(
                  query.businessId,
                  from,
                  to
                )
              : await productionRunRepository.findForReportDetails(
                  query.businessId,
                  from,
                  to
                );

    const detailsByKey = buildDetailsByKey(detailRows, query.period);

    const buckets = keys.map((key) => {
      const row = rowMap.get(key);
      return {
        label: bucketLabel(key, query.period),
        date: key,
        count: row?.count ?? 0,
        total: row?.total ?? 0,
        revenue: row && "revenue" in row ? row.revenue : undefined,
        cost: row && "cost" in row ? row.cost : undefined,
        details: detailsByKey.get(key) ?? [],
      };
    });

    const totalCount = buckets.reduce((a, b) => a + b.count, 0);
    const totalAmount = buckets.reduce((a, b) => a + b.total, 0);

    let paymentBreakdown: PaymentMethodBreakdown[] | undefined;
    let totalCollected: number | undefined;
    if (query.kind === "sales") {
      const paymentRows = await saleRepository.aggregatePaymentMethods(
        query.businessId,
        from,
        to
      );
      ({ paymentBreakdown, totalCollected } =
        paymentBreakdownFromRows(paymentRows));
    } else if (query.kind === "services") {
      const paymentRows = await appointmentRepository.aggregatePaymentMethods(
        query.businessId,
        from,
        to
      );
      ({ paymentBreakdown, totalCollected } =
        paymentBreakdownFromRows(paymentRows));
    }

    return {
      kind: query.kind,
      period: query.period as ReportPeriod,
      from: from.toISOString(),
      to: to.toISOString(),
      buckets,
      totalCount,
      totalAmount,
      paymentBreakdown,
      totalCollected,
    };
  },

  async getProfitReport(
    businessId: string,
    from: Date,
    to: Date,
    period: ReportPeriod,
    includeServices: boolean
  ): Promise<ReportResult> {
    const dateFormat = mongoDateFormat(period);

    const [productRows, serviceRows, productDetailRows, serviceDetailRows] =
      await Promise.all([
        saleRepository.aggregateGrossProfitReport(
          businessId,
          from,
          to,
          dateFormat
        ),
        includeServices
          ? appointmentRepository.aggregateReport(
              businessId,
              from,
              to,
              dateFormat
            )
          : Promise.resolve([]),
        saleRepository.findForGrossProfitDetails(businessId, from, to),
        includeServices
          ? appointmentRepository.findForReportDetails(businessId, from, to)
          : Promise.resolve([]),
      ]);

    const productMap = new Map(productRows.map((r) => [r.key, r]));
    const serviceMap = new Map(serviceRows.map((r) => [r.key, r]));

    const detailsByKey = buildDetailsByKey(productDetailRows, period);
    if (includeServices) {
      const serviceDetails = buildDetailsByKey(serviceDetailRows, period);
      for (const [key, lines] of serviceDetails) {
        const list = detailsByKey.get(key) ?? [];
        detailsByKey.set(key, [...list, ...lines]);
      }
    }

    const keys = mergeBucketKeys(
      from,
      to,
      period,
      [...productRows.map((r) => r.key), ...serviceRows.map((r) => r.key)]
    );
    const buckets = keys.map((key) => {
      const product = productMap.get(key);
      const service = serviceMap.get(key);
      const productRevenue = product?.revenue ?? 0;
      const serviceRevenue = service?.total ?? 0;
      const cost = product?.cost ?? 0;
      const profit = productRevenue - cost + serviceRevenue;

      return {
        label: bucketLabel(key, period),
        date: key,
        count: (product?.count ?? 0) + (service?.count ?? 0),
        total: profit,
        revenue: productRevenue + serviceRevenue,
        cost,
        productRevenue,
        serviceRevenue: includeServices ? serviceRevenue : undefined,
        productCount: product?.count ?? 0,
        serviceCount: service?.count ?? 0,
        details: detailsByKey.get(key) ?? [],
      };
    });

    const productRevenue = buckets.reduce(
      (sum, bucket) => sum + (bucket.productRevenue ?? 0),
      0
    );
    const serviceRevenue = includeServices
      ? buckets.reduce((sum, bucket) => sum + (bucket.serviceRevenue ?? 0), 0)
      : 0;
    const totalCost = buckets.reduce(
      (sum, bucket) => sum + (bucket.cost ?? 0),
      0
    );
    const totalProfit = productRevenue - totalCost + serviceRevenue;

    return {
      kind: "profit",
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      buckets,
      totalCount: buckets.reduce((sum, bucket) => sum + bucket.count, 0),
      totalAmount: totalProfit,
      totalRevenue: productRevenue + serviceRevenue,
      productRevenue,
      serviceRevenue: includeServices ? serviceRevenue : undefined,
      totalCost,
    };
  },
};
