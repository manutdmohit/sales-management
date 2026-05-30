import type { InventoryTransaction, InventoryTransactionType } from "@/domain/types";

const POSITIVE_TYPES: InventoryTransactionType[] = [
  "PURCHASE",
  "RETURN",
];
const NEGATIVE_TYPES: InventoryTransactionType[] = [
  "SALE",
  "DAMAGE",
  "EXPIRED",
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

export function calculateStockFromTransactions(
  transactions: InventoryTransaction[]
): number {
  return transactions.reduce(
    (sum, tx) => sum + signedQuantity(tx.type, tx.quantity),
    0
  );
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
    map.set(tx.productId, (map.get(tx.productId) ?? 0) + delta);
  }
  return map;
}
