import {
  calculateStockFromTransactions,
  validateStockAvailability,
} from "@/domain/inventory/inventory.engine";
import { formatQuantity } from "@/lib/format-quantity";
import type {
  InventoryTransaction,
  Product,
  ProductKind,
  StockSummary,
} from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { eventBus } from "@/lib/events/event-bus";
import { batchRepository } from "@/repositories/batch.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productRepository } from "@/repositories/product.repository";
import { businessService } from "./business.service";
import { expiryService } from "./expiry.service";

export const inventoryService = {
  async getStock(businessId: string, productId: string): Promise<number> {
    const transactions = await inventoryRepository.findByProduct(
      businessId,
      productId
    );
    return calculateStockFromTransactions(transactions);
  },

  async getSummary(
    businessId: string,
    options?: {
      search?: string;
      productKind?: ProductKind;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<StockSummary[] | PaginatedResult<StockSummary>> {
    await businessService.getById(businessId);
    const stockRows = await inventoryRepository.aggregateStockByBusiness(
      businessId
    );
    const stockMap = new Map(
      stockRows.map((r) => [r.productId, r.stock])
    );

    const toSummary = (p: Product): StockSummary => {
      const stock = stockMap.get(p._id) ?? 0;
      return {
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        productKind: p.productKind,
        unitId: p.unitId,
        stock,
        minStock: p.minStock,
        trackExpiry: p.trackExpiry,
        isLowStock: stock <= p.minStock,
      };
    };

    if (options?.page != null && options?.pageSize != null) {
      const result = await productRepository.findByBusinessPaginated(
        businessId,
        {
          activeOnly: true,
          search: options.search,
          productKind: options.productKind,
          sort: options.sort,
          dir: options.dir,
          page: options.page,
          pageSize: options.pageSize,
        }
      );
      return {
        items: result.items.map((p) => toSummary(p)),
        meta: result.meta,
      };
    }

    const products = await productRepository.findByBusiness(businessId, {
      search: options?.search,
      productKind: options?.productKind,
    });
    return products.map((p) => toSummary(p));
  },

  async addAdjustment(input: {
    businessId: string;
    productId: string;
    batchId?: string;
    quantity: number;
    notes?: string;
  }): Promise<InventoryTransaction> {
    await businessService.getById(input.businessId);
    const product = await productRepository.findById(input.productId);
    if (!product || product.businessId !== input.businessId) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const tx = await inventoryRepository.create({
      businessId: input.businessId,
      productId: input.productId,
      batchId: input.batchId,
      type: "ADJUSTMENT",
      quantity: input.quantity,
      notes: input.notes,
      timestamp: new Date(),
    });

    await eventBus.emit({
      type: "STOCK_UPDATED",
      businessId: input.businessId,
      payload: { productId: input.productId, transactionId: tx._id },
      timestamp: new Date(),
    });

    return tx;
  },

  async writeOffBatch(input: {
    businessId: string;
    batchId: string;
    type: "EXPIRED" | "DAMAGE";
    quantity?: number;
    notes?: string;
  }): Promise<InventoryTransaction> {
    await businessService.getById(input.businessId);

    const batch = await batchRepository.findById(input.batchId);
    if (!batch || batch.businessId !== input.businessId) {
      throw new AppError("Batch not found", 404, "NOT_FOUND");
    }
    if (batch.remainingQuantity <= 0) {
      throw new AppError("Batch has no remaining stock", 400);
    }

    const quantity = input.quantity ?? batch.remainingQuantity;
    if (quantity <= 0 || quantity > batch.remainingQuantity) {
      throw new AppError(
        `Write-off quantity must be between 1 and ${formatQuantity(batch.remainingQuantity)}`,
        400
      );
    }

    const product = await productRepository.findById(batch.productId);
    if (!product || product.businessId !== input.businessId) {
      throw new AppError("Product not found", 404, "NOT_FOUND");
    }

    const defaultNote =
      input.type === "EXPIRED"
        ? `Expired batch ${batch.batchNumber}`
        : `Damaged batch ${batch.batchNumber}`;

    const tx = await inventoryRepository.create({
      businessId: input.businessId,
      productId: batch.productId,
      batchId: batch._id,
      type: input.type,
      quantity,
      notes: input.notes?.trim() || defaultNote,
      timestamp: new Date(),
    });

    const updatedBatch = await batchRepository.decrementRemaining(
      batch._id,
      quantity
    );
    if (!updatedBatch) {
      throw new AppError("Failed to update batch quantity", 409);
    }

    await eventBus.emit({
      type: "STOCK_UPDATED",
      businessId: input.businessId,
      payload: {
        productId: batch.productId,
        batchId: batch._id,
        transactionId: tx._id,
      },
      timestamp: new Date(),
    });

    await expiryService.refreshExpiryNotifications(input.businessId);

    return tx;
  },

  async validateAvailability(
    businessId: string,
    productId: string,
    quantity: number
  ): Promise<void> {
    const stock = await this.getStock(businessId, productId);
    if (!validateStockAvailability(stock, quantity)) {
      throw new AppError(
        `Insufficient stock for product ${productId}. Available: ${formatQuantity(stock)}`,
        409,
        "INSUFFICIENT_STOCK"
      );
    }
  },
};
