import {
  calculateStockFromTransactions,
  validateStockAvailability,
} from "@/domain/inventory/inventory.engine";
import type { InventoryTransaction, StockSummary } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { eventBus } from "@/lib/events/event-bus";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productRepository } from "@/repositories/product.repository";
import { businessService } from "./business.service";

export const inventoryService = {
  async getStock(businessId: string, productId: string): Promise<number> {
    const transactions = await inventoryRepository.findByProduct(
      businessId,
      productId
    );
    return calculateStockFromTransactions(transactions);
  },

  async getSummary(businessId: string): Promise<StockSummary[]> {
    await businessService.getById(businessId);
    const [products, stockRows] = await Promise.all([
      productRepository.findByBusiness(businessId),
      inventoryRepository.aggregateStockByBusiness(businessId),
    ]);
    const stockMap = new Map(
      stockRows.map((r) => [r.productId, r.stock])
    );
    return products.map((p) => {
      const stock = stockMap.get(p._id) ?? 0;
      return {
        productId: p._id,
        productName: p.name,
        sku: p.sku,
        stock,
        minStock: p.minStock,
        trackExpiry: p.trackExpiry,
        isLowStock: stock <= p.minStock,
      };
    });
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

  async validateAvailability(
    businessId: string,
    productId: string,
    quantity: number
  ): Promise<void> {
    const stock = await this.getStock(businessId, productId);
    if (!validateStockAvailability(stock, quantity)) {
      throw new AppError(
        `Insufficient stock for product ${productId}. Available: ${stock}`,
        409,
        "INSUFFICIENT_STOCK"
      );
    }
  },
};
