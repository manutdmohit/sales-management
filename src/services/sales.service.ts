import type { Sale, SaleItem } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { eventBus } from "@/lib/events/event-bus";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { batchRepository } from "@/repositories/batch.repository";
import { businessService } from "./business.service";
import { inventoryService } from "./inventory.service";
import { productService } from "./product.service";
import type { z } from "zod";
import type { createSaleSchema } from "@/schemas/sale.schema";

type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const salesService = {
  async list(businessId: string): Promise<Sale[]> {
    await businessService.getById(businessId);
    return saleRepository.findByBusiness(businessId);
  },

  async create(input: CreateSaleInput): Promise<Sale> {
    const business = await businessService.getById(input.businessId);

    for (const item of input.items) {
      await inventoryService.validateAvailability(
        input.businessId,
        item.productId,
        item.quantity
      );
    }

    const saleItems: SaleItem[] = [];
    let subtotal = 0;

    for (const item of input.items) {
      const product = await productService.getById(item.productId);
      if (product.businessId !== input.businessId) {
        throw new AppError("Product does not belong to business", 400);
      }
      const unitPrice = item.unitPrice ?? product.pricing.selling;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      saleItems.push({
        productId: product._id,
        productName: product.name,
        batchId: item.batchId,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
      });
    }

    const discount = input.discount ?? 0;
    const tax = input.tax ?? 0;
    const total = Math.max(0, subtotal - discount + tax);

    const prefix = business.settings.invoicePrefix ?? business.code;
    const count = await saleRepository.countByBusiness(input.businessId);
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(6, "0")}`;

    const sale = await saleRepository.create({
      businessId: input.businessId,
      invoiceNumber,
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      paymentMethod: input.paymentMethod,
      createdAt: new Date(),
    });

    const timestamp = new Date();
    const transactions = saleItems.map((item) => ({
      businessId: input.businessId,
      productId: item.productId,
      batchId: item.batchId,
      type: "SALE" as const,
      quantity: item.quantity,
      referenceId: sale._id,
      timestamp,
    }));
    await inventoryRepository.createMany(transactions);

    for (const item of saleItems) {
      if (item.batchId) {
        const updated = await batchRepository.decrementRemaining(
          item.batchId,
          item.quantity
        );
        if (!updated) {
          throw new AppError("Batch stock insufficient", 409);
        }
      }
      await eventBus.emit({
        type: "STOCK_UPDATED",
        businessId: input.businessId,
        payload: { productId: item.productId, saleId: sale._id },
        timestamp: new Date(),
      });
    }

    await eventBus.emit({
      type: "SALE_CREATED",
      businessId: input.businessId,
      payload: { saleId: sale._id, invoiceNumber, total },
      timestamp: new Date(),
    });

    return sale;
  },
};
