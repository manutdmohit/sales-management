import type { ProductionRun } from "@/domain/types";
import { hasFeature } from "@/domain/capabilities";
import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { eventBus } from "@/lib/events/event-bus";
import { batchRepository } from "@/repositories/batch.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productionRunRepository } from "@/repositories/production-run.repository";
import { productRepository } from "@/repositories/product.repository";
import { expiryService } from "./expiry.service";
import { businessService } from "./business.service";
import { inventoryService } from "./inventory.service";
import type { CreateProductionRunInput } from "@/schemas/production.schema";
import {
  buildMaterialsSnapshot,
  unitMaterialCost as calcUnitMaterialCost,
} from "@/lib/production-cost";
import {
  resolveProductUnitCost,
  weightedAverageUnitCost,
} from "@/lib/inventory-cost";

export const productionService = {
  async list(
    businessId: string,
    options?: {
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<ProductionRun>> {
    const business = await businessService.getById(businessId);
    if (!hasFeature(business.type, "manufacturing")) {
      throw new AppError(
        "Manufacturing is not available for this business",
        400,
        "INVALID_BUSINESS_TYPE"
      );
    }
    return productionRunRepository.findByBusinessPaginated(businessId, {
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 20,
    });
  },

  async create(input: CreateProductionRunInput) {
    const business = await businessService.getById(input.businessId);
    if (!hasFeature(business.type, "manufacturing")) {
      throw new AppError(
        "Manufacturing is not available for this business",
        400,
        "INVALID_BUSINESS_TYPE"
      );
    }

    const finished = await productRepository.findById(input.finishedProductId);
    if (!finished || finished.businessId !== input.businessId) {
      throw new AppError("Finished product not found", 404, "NOT_FOUND");
    }
    if (finished.productKind === "RAW") {
      throw new AppError("Only finished products can be produced", 400);
    }
    if (!finished.isActive) {
      throw new AppError("Finished product is inactive", 400);
    }
    if (!finished.recipe?.length) {
      throw new AppError(
        "Define a recipe on this finished product before production",
        400
      );
    }

    const recipeSnapshot = finished.recipe.map((line) => ({ ...line }));
    const requirements = recipeSnapshot.map((line) => ({
      ...line,
      quantityRequired: line.quantityPerUnit * input.quantityProduced,
    }));

    for (const req of requirements) {
      await inventoryService.validateAvailability(
        input.businessId,
        req.rawProductId,
        req.quantityRequired
      );
    }

    const rawProducts = await Promise.all(
      requirements.map((req) => productRepository.findById(req.rawProductId))
    );
    const productsById = new Map(
      rawProducts
        .filter((p): p is NonNullable<typeof p> => p != null)
        .map((p) => [p._id, p])
    );
    const { materials, totalMaterialCost } = buildMaterialsSnapshot(
      requirements.map((req) => ({
        rawProductId: req.rawProductId,
        rawProductName: req.rawProductName,
        rawUnitId: req.rawUnitId,
        quantityRequired: req.quantityRequired,
      })),
      productsById
    );

    const unitMaterialCost = calcUnitMaterialCost(
      totalMaterialCost,
      input.quantityProduced
    );

    const stockBefore = await inventoryService.getStock(
      input.businessId,
      finished._id
    );
    const currentUnitCost = resolveProductUnitCost(finished);
    const nextUnitCost = weightedAverageUnitCost(
      stockBefore,
      currentUnitCost,
      input.quantityProduced,
      unitMaterialCost
    );

    const run = await productionRunRepository.create({
      businessId: input.businessId,
      finishedProductId: finished._id,
      finishedProductName: finished.name,
      finishedUnitId: finished.unitId,
      quantityProduced: input.quantityProduced,
      recipeSnapshot,
      materialsSnapshot: materials,
      totalMaterialCost,
      unitMaterialCost,
      notes: input.notes,
      createdAt: new Date(),
    });

    let outputBatchId: string | undefined;
    if (finished.trackExpiry) {
      const batchNumber = input.batchNumber?.trim();
      if (!batchNumber) {
        throw new AppError(
          "Batch number is required for expiry-tracked products",
          400
        );
      }
      if (!input.expiryDate) {
        throw new AppError(
          "Expiry date is required for expiry-tracked products",
          400
        );
      }
      const batch = await batchRepository.create({
        businessId: input.businessId,
        productId: finished._id,
        batchNumber,
        expiryDate: input.expiryDate,
        quantity: input.quantityProduced,
        remainingQuantity: input.quantityProduced,
      });
      outputBatchId = batch._id;
    }

    const timestamp = new Date();
    const transactions: Parameters<typeof inventoryRepository.createMany>[0] =
      [];

    for (const req of requirements) {
      transactions.push({
        businessId: input.businessId,
        productId: req.rawProductId,
        type: "PRODUCTION_CONSUME",
        quantity: req.quantityRequired,
        referenceId: run._id,
        notes: input.notes,
        timestamp,
      });
    }

    transactions.push({
      businessId: input.businessId,
      productId: finished._id,
      batchId: outputBatchId,
      type: "PRODUCTION_OUTPUT",
      quantity: input.quantityProduced,
      referenceId: run._id,
      notes: input.notes,
      timestamp,
    });

    await inventoryRepository.createMany(transactions);

    await productRepository.update(finished._id, {
      pricing: { ...finished.pricing, unitCost: nextUnitCost },
    });

    const affectedProductIds = new Set([
      finished._id,
      ...requirements.map((r) => r.rawProductId),
    ]);

    for (const productId of affectedProductIds) {
      await eventBus.emit({
        type: "STOCK_UPDATED",
        businessId: input.businessId,
        payload: { productId, productionRunId: run._id },
        timestamp: new Date(),
      });
    }

    if (finished.trackExpiry) {
      await expiryService.ensureExpiryNotifications(input.businessId);
    }

    return run;
  },
};
