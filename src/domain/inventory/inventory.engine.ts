import type { InventoryTransaction, InventoryTransactionType } from "@/domain/types";

const POSITIVE_TYPES: InventoryTransactionType[] = [
  "PURCHASE",
  "RETURN",
  "PRODUCTION_OUTPUT",
];
const NEGATIVE_TYPES: InventoryTransactionType[] = [
  "SALE",
  "DAMAGE",
  "EXPIRED",
  "PRODUCTION_CONSUME",
];

/**
 * Golden rule: stock is derived from transactions, never stored directly.
 * ADJUSTMENT uses signed quantity as recorded.
 */
export function signedQuantity(
  type: InventoryTransactionType,
  quantity: number
): number {
  const abs = Math.abs(quantity);
  if (type === "ADJUSTMENT") return quantity;
  if (POSITIVE_TYPES.includes(type)) return abs;
  if (NEGATIVE_TYPES.includes(type)) return -abs;
  return quantity;
}

function normalizeQuantity(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateStockFromTransactions(
  transactions: InventoryTransaction[]
): number {
  const total = transactions.reduce(
    (sum, tx) => sum + signedQuantity(tx.type, tx.quantity),
    0
  );
  return normalizeQuantity(total);
}

export function validateStockAvailability(
  currentStock: number,
  requestedQuantity: number
): boolean {
  return currentStock >= requestedQuantity;
}

export function groupStockByProduct(
  transactions: InventoryTransaction[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    const delta = signedQuantity(tx.type, tx.quantity);
    const next = (map.get(tx.productId) ?? 0) + delta;
    map.set(tx.productId, normalizeQuantity(next));
  }
  return map;
}
