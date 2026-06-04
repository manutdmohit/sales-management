import type { Purchase, PurchaseItem } from "@/domain/types";
import { eventBus } from "@/lib/events/event-bus";
import { AppError } from "@/lib/errors";
import {
  resolveProductUnitCost,
  weightedAverageUnitCost,
} from "@/lib/inventory-cost";
import { assertReceiptBelongsToBusiness } from "@/lib/cloudinary";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { batchRepository } from "@/repositories/batch.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { purchaseRepository } from "@/repositories/purchase.repository";
import { productRepository } from "@/repositories/product.repository";
import { businessService } from "./business.service";
import { inventoryService } from "./inventory.service";
import { productService } from "./product.service";
import { supplierService } from "./supplier.service";
import { expiryService } from "./expiry.service";
import type { z } from "zod";
import type { createPurchaseSchema, updatePurchaseSchema } from "@/schemas/purchase.schema";

type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;

export const purchaseService = {
  async list(
    businessId: string,
    options?: {
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<Purchase[] | PaginatedResult<Purchase>> {
    await businessService.getById(businessId);
    if (options?.page != null && options?.pageSize != null) {
      return purchaseRepository.findByBusinessPaginated(businessId, {
        page: options.page,
        pageSize: options.pageSize,
        search: options.search,
        sort: options.sort,
        dir: options.dir,
      });
    }
    return purchaseRepository.findByBusiness(businessId);
  },

  async create(input: CreatePurchaseInput): Promise<Purchase> {
    await businessService.getById(input.businessId);
    const supplier = await supplierService.getById(input.supplierId);
    if (supplier.businessId !== input.businessId) {
      throw new AppError("Supplier does not belong to business", 400);
    }
    if (!supplier.isActive) {
      throw new AppError("Supplier is inactive", 400);
    }

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
        unitId: product.unitId,
        unitCost: item.unitCost,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
      });
    }

    const tax = input.tax ?? 0;
    const total = subtotal + tax;

    if (input.receipts?.length) {
      for (const receipt of input.receipts) {
        assertReceiptBelongsToBusiness(receipt, input.businessId, "purchases");
      }
    }

    const purchase = await purchaseRepository.create({
      businessId: input.businessId,
      supplierId: supplier._id,
      supplierName: supplier.name,
      items: purchaseItems,
      subtotal,
      tax,
      total,
      referenceNumber: input.referenceNumber,
      receipts: input.receipts ?? [],
      createdAt: new Date(),
    });

    const timestamp = new Date();
    const transactions: Parameters<typeof inventoryRepository.createMany>[0] =
      [];
    const itemsWithBatches: PurchaseItem[] = [];

    for (const item of purchaseItems) {
      const product = await productService.getById(item.productId);
      let batchId: string | undefined;
      let lineItem: PurchaseItem = { ...item };

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
        lineItem = { ...lineItem, batchId };
      }

      itemsWithBatches.push(lineItem);

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

    await purchaseRepository.update(purchase._id, { items: itemsWithBatches });
    const savedPurchase = {
      ...purchase,
      items: itemsWithBatches,
    };

    await inventoryRepository.createMany(transactions);

    for (const item of purchaseItems) {
      const product = await productService.getById(item.productId);
      const stockAfter = await inventoryService.getStock(
        input.businessId,
        item.productId
      );
      const stockBefore = stockAfter - item.quantity;
      const currentUnitCost = resolveProductUnitCost(product);
      const nextUnitCost = weightedAverageUnitCost(
        stockBefore,
        currentUnitCost,
        item.quantity,
        item.unitCost
      );
      await productRepository.update(item.productId, {
        pricing: { ...product.pricing, unitCost: nextUnitCost },
      });
    }

    await eventBus.emit({
      type: "PURCHASE_CREATED",
      businessId: input.businessId,
      payload: {
        purchaseId: savedPurchase._id,
        total,
        supplierName: supplier.name,
        itemCount: itemsWithBatches.length,
      },
      timestamp: new Date(),
    });

    for (const item of itemsWithBatches) {
      await eventBus.emit({
        type: "STOCK_UPDATED",
        businessId: input.businessId,
        payload: { productId: item.productId, purchaseId: savedPurchase._id },
        timestamp: new Date(),
      });
    }

    await expiryService.ensureExpiryNotifications(input.businessId);

    return savedPurchase;
  },

  async getById(id: string): Promise<Purchase> {
    const purchase = await purchaseRepository.findById(id);
    if (!purchase) {
      throw new AppError("Purchase not found", 404, "NOT_FOUND");
    }
    await businessService.getById(purchase.businessId);
    return purchase;
  },

  async update(id: string, input: UpdatePurchaseInput): Promise<Purchase> {
    const existing = await this.getById(id);

    if (input.supplierId) {
      const supplier = await supplierService.getById(input.supplierId);
      if (supplier.businessId !== existing.businessId) {
        throw new AppError("Supplier does not belong to business", 400);
      }
      if (!supplier.isActive) {
        throw new AppError("Supplier is inactive", 400);
      }
    }

    if (input.receipts?.length) {
      for (const receipt of input.receipts) {
        assertReceiptBelongsToBusiness(
          receipt,
          existing.businessId,
          "purchases"
        );
      }
    }

    const items = existing.items.map((item) => ({ ...item }));
    const batches = await batchRepository.findByPurchaseId(id);
    const usedBatchIds = new Set<string>();

    function resolveBatchId(lineIndex: number): string | undefined {
      const item = items[lineIndex];
      if (item.batchId) return item.batchId;
      const batch = batches.find(
        (b) =>
          b.productId === item.productId && !usedBatchIds.has(b._id)
      );
      return batch?._id;
    }

    if (input.lineUpdates?.length) {
      for (const line of input.lineUpdates) {
        if (line.index >= items.length) {
          throw new AppError(`Invalid line index ${line.index}`, 400);
        }
        const item = items[line.index];
        const product = await productService.getById(item.productId);
        if (!product.trackExpiry) continue;

        if (line.batchNumber !== undefined) {
          item.batchNumber = line.batchNumber;
        }
        if (line.expiryDate !== undefined) {
          item.expiryDate = line.expiryDate ?? undefined;
        }

        const batchId = resolveBatchId(line.index);
        if (batchId) {
          usedBatchIds.add(batchId);
          item.batchId = batchId;
          await batchRepository.updateBatchMeta(batchId, {
            ...(line.batchNumber !== undefined && {
              batchNumber: line.batchNumber,
            }),
            ...(line.expiryDate !== undefined && {
              expiryDate: line.expiryDate,
            }),
          });
        }
      }
    }

    const tax = input.tax ?? existing.tax;
    const total = existing.subtotal + tax;

    const updated = await purchaseRepository.update(id, {
      ...(input.referenceNumber !== undefined && {
        referenceNumber: input.referenceNumber,
      }),
      ...(input.supplierId && {
        supplierId: input.supplierId,
        supplierName: (await supplierService.getById(input.supplierId)).name,
      }),
      ...(input.receipts !== undefined && { receipts: input.receipts }),
      tax,
      total,
      items,
    });

    if (!updated) {
      throw new AppError("Purchase not found", 404, "NOT_FOUND");
    }

    if (input.lineUpdates?.length) {
      await expiryService.ensureExpiryNotifications(existing.businessId);
    }

    return updated;
  },
};
