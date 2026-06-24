import type { ReportPeriod } from "@/lib/report-ranges";
import { resolveReportRange } from "@/lib/report-ranges";
import { hasFeature } from "@/domain/capabilities";
import type { Product, StockSummary } from "@/domain/types";
import { expiryAlertLevel } from "@/domain/expiry";
import { appointmentRepository } from "@/repositories/appointment.repository";
import { batchRepository } from "@/repositories/batch.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productRepository } from "@/repositories/product.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { businessService } from "./business.service";

export type DashboardExpiryAlert = {
  _id: string;
  productName: string;
  sku: string;
  batchNumber: string;
  remainingQuantity: number;
  unitId?: string;
  expiryDate: string;
  level: "warning" | "critical";
};

export type DashboardData = {
  summary: StockSummary[];
  expiryAlerts: DashboardExpiryAlert[];
  profit: {
    total: number;
    from: string;
    to: string;
    period: ReportPeriod;
  };
};

function toSummary(
  product: Product,
  stockMap: Map<string, number>
): StockSummary {
  const stock = stockMap.get(product._id) ?? 0;
  return {
    productId: product._id,
    productName: product.name,
    sku: product.sku,
    productKind: product.productKind,
    unitId: product.unitId,
    stock,
    minStock: product.minStock,
    trackExpiry: product.trackExpiry,
    isLowStock: stock <= product.minStock,
  };
}

async function buildExpiryAlerts(
  businessId: string,
  asOf = new Date()
): Promise<DashboardExpiryAlert[]> {
  const batches = await batchRepository.findActiveWithExpiry(businessId);
  const productIds = [...new Set(batches.map((batch) => batch.productId))];
  const products = await productRepository.findByIds(productIds);
  const productMap = new Map(products.map((product) => [product._id, product]));

  const alerts: DashboardExpiryAlert[] = [];
  for (const batch of batches) {
    if (!batch.expiryDate) continue;
    const level = expiryAlertLevel(new Date(batch.expiryDate), asOf);
    if (!level) continue;

    const product = productMap.get(batch.productId);
    if (!product || !product.trackExpiry) continue;

    alerts.push({
      _id: batch._id,
      productName: product.name,
      sku: product.sku,
      batchNumber: batch.batchNumber,
      remainingQuantity: batch.remainingQuantity,
      unitId: product.unitId,
      expiryDate: new Date(batch.expiryDate).toISOString(),
      level,
    });
  }

  return alerts;
}

export const dashboardService = {
  async getDashboard(
    businessId: string,
    period: ReportPeriod = "daily"
  ): Promise<DashboardData> {
    const business = await businessService.getById(businessId);
    const includeServices = hasFeature(business.type, "services");
    const { from, to } = resolveReportRange(period);

    const [stockRows, products, expiryAlerts, productTotals, serviceTotals] =
      await Promise.all([
        inventoryRepository.aggregateStockByBusiness(businessId),
        productRepository.findByBusiness(businessId),
        buildExpiryAlerts(businessId),
        saleRepository.aggregateProfitTotals(businessId, from, to),
        includeServices
          ? appointmentRepository.aggregateServiceTotals(businessId, from, to)
          : Promise.resolve({ revenue: 0, count: 0 }),
      ]);

    const stockMap = new Map(stockRows.map((row) => [row.productId, row.stock]));
    const summary = products.map((product) => toSummary(product, stockMap));
    const profitTotal =
      productTotals.revenue - productTotals.cost + serviceTotals.revenue;

    return {
      summary,
      expiryAlerts,
      profit: {
        total: profitTotal,
        from: from.toISOString(),
        to: to.toISOString(),
        period,
      },
    };
  },
};
