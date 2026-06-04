import type { ProductKind } from "@/domain/types";

export type StockUnitCategory = "mass" | "volume" | "count";

export const STOCK_UNIT_IDS = [
  "kg",
  "g",
  "L",
  "ml",
  "piece",
  "pack",
  "bag",
  "box",
] as const;

export type StockUnitId = (typeof STOCK_UNIT_IDS)[number];

export interface StockUnit {
  id: StockUnitId;
  label: string;
  symbol: string;
  category: StockUnitCategory;
}

/** Standard stock units — all inventory math uses the product's chosen unit. */
export const STOCK_UNITS: StockUnit[] = [
  { id: "kg", label: "Kilogram", symbol: "kg", category: "mass" },
  { id: "g", label: "Gram", symbol: "g", category: "mass" },
  { id: "L", label: "Litre", symbol: "L", category: "volume" },
  { id: "ml", label: "Millilitre", symbol: "ml", category: "volume" },
  { id: "piece", label: "Piece", symbol: "pc", category: "count" },
  { id: "pack", label: "Pack", symbol: "pack", category: "count" },
  { id: "bag", label: "Bag", symbol: "bag", category: "count" },
  { id: "box", label: "Box", symbol: "box", category: "count" },
];

export const DEFAULT_UNIT_ID: StockUnitId = "piece";
export const DEFAULT_RAW_UNIT_ID: StockUnitId = "kg";
export const DEFAULT_FINISHED_UNIT_ID: StockUnitId = "pack";

const unitById = new Map<StockUnitId, StockUnit>(
  STOCK_UNITS.map((u) => [u.id, u])
);

export function isValidUnitId(unitId: string): unitId is StockUnitId {
  return unitById.has(unitId as StockUnitId);
}

export function getStockUnit(unitId?: string): StockUnit | undefined {
  if (!unitId || !isValidUnitId(unitId)) return undefined;
  return unitById.get(unitId);
}

export function getUnitSymbol(unitId?: string): string | undefined {
  return getStockUnit(unitId)?.symbol;
}

export function getUnitLabel(unitId?: string): string | undefined {
  return getStockUnit(unitId)?.label;
}

export function defaultUnitForKind(kind: ProductKind): StockUnitId {
  return kind === "RAW" ? DEFAULT_RAW_UNIT_ID : DEFAULT_FINISHED_UNIT_ID;
}

export function resolveUnitId(
  unitId: string | undefined,
  kind: ProductKind
): StockUnitId {
  if (unitId && isValidUnitId(unitId)) return unitId;
  return defaultUnitForKind(kind);
}
