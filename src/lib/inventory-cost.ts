import type { Product } from "@/domain/types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Inventory unit cost used for COGS (falls back to purchase price). */
export function resolveProductUnitCost(product: Product): number {
  return product.pricing.unitCost ?? product.pricing.purchase;
}

/**
 * Weighted-average unit cost after receiving `addedQty` at `addedUnitCost`
 * into stock that previously held `currentStock` at `currentUnitCost`.
 */
export function weightedAverageUnitCost(
  currentStock: number,
  currentUnitCost: number,
  addedQty: number,
  addedUnitCost: number
): number {
  if (addedQty <= 0) return roundMoney(currentUnitCost);
  if (currentStock <= 0) return roundMoney(addedUnitCost);
  const totalValue =
    currentStock * currentUnitCost + addedQty * addedUnitCost;
  const totalQty = currentStock + addedQty;
  return roundMoney(totalValue / totalQty);
}

export function lineCostFromUnitCost(
  unitCost: number,
  quantity: number
): number {
  return roundMoney(unitCost * quantity);
}
