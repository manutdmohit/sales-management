import type { Purchase, PurchaseItem } from "@/domain/types";
import { eventBus } from "@/lib/events/event-bus";
import { AppError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/pagination";
import { batchRepository } from "@/repositories/batch.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { purchaseRepository } from "@/repositories/purchase.repository";
import { businessService } from "./business.service";
import { productService } from "./product.service";
import type { z } from "zod";
import type { createPurchaseSchema } from "@/schemas/purchase.schema";

type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;

export const purchaseService = {
  async list(
    businessId: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<Purchase[] | PaginatedResult<Purchase>> {
    await businessService.getById(businessId);
    if (options?.page != null && options?.pageSize != null) {
      return purchaseRepository.findByBusinessPaginated(
        businessId,
        options.page,
        options.pageSize
      );
    }
    return purchaseRepository.findByBusiness(businessId);
  },

  async create(input: CreatePurchaseInput): Promise<Purchase> {
    await businessService.getById(input.businessId);

    const purchaseItems: PurchaseItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      const product = await productService.getById(item.productId);
      if (product.businessId !== input.businessId) {
        throw new AppError("Product does not belong to business", 400);
      }
      const lineTotal = item.unitCost * item.quantity;
      subtotal += lineTotal;
      purchaseItems.push({
        productId: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      });
    }

    const tax = input.tax ?? 0;
    const total = subtotal + tax;

    const purchase = await purchaseRepository.create({
      businessId: input.businessId,
      supplierName: input.supplierName,
      items: purchaseItems,
      subtotal,
      tax,
      total,
      referenceNumber: input.referenceNumber,
      createdAt: new Date(),
    });

    const timestamp = new Date();
    const transactions: Parameters<typeof inventoryRepository.createMany>[0] =
      [];

    for (const item of purchaseItems) {
      const product = await productService.getById(item.productId);
      let batchId: string | undefined;

      if (product.trackExpiry) {
        const batch = await batchRepository.create({
          businessId: input.businessId,
          productId: item.productId,
          batchNumber: item.batchNumber ?? `B-${Date.now()}`,
          expiryDate: item.expiryDate,
          quantity: item.quantity,
          remainingQuantity: item.quantity,
          purchaseId: purchase._id,
        });
        batchId = batch._id;
      }

      transactions.push({
        businessId: input.businessId,
        productId: item.productId,
        batchId,
        type: "PURCHASE",
        quantity: item.quantity,
        referenceId: purchase._id,
        timestamp,
      });
    }

    await inventoryRepository.createMany(transactions);

    await eventBus.emit({
      type: "PURCHASE_CREATED",
      businessId: input.businessId,
      payload: { purchaseId: purchase._id, total },
      timestamp: new Date(),
    });

    for (const item of purchaseItems) {
      await eventBus.emit({
        type: "STOCK_UPDATED",
        businessId: input.businessId,
        payload: { productId: item.productId, purchaseId: purchase._id },
        timestamp: new Date(),
      });
    }

    return purchase;
  },
};
