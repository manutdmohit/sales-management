import type { Product, ProductionMaterialSnapshot } from "@/domain/types";

export type MaterialRequirement = {
  rawProductId: string;
  rawProductName?: string;
  rawUnitId?: string;
  quantityRequired: number;
};

export function buildMaterialsSnapshot(
  requirements: MaterialRequirement[],
  productsById: Map<string, Product>
): { materials: ProductionMaterialSnapshot[]; totalMaterialCost: number } {
  const materials: ProductionMaterialSnapshot[] = [];
  let totalMaterialCost = 0;

  for (const req of requirements) {
    const raw = productsById.get(req.rawProductId);
    const unitCost = raw?.pricing.purchase ?? 0;
    const lineCost = roundMoney(req.quantityRequired * unitCost);
    totalMaterialCost += lineCost;
    materials.push({
      rawProductId: req.rawProductId,
      rawProductName: req.rawProductName ?? raw?.name,
      rawUnitId: req.rawUnitId ?? raw?.unitId,
      quantityConsumed: req.quantityRequired,
      unitCost,
      lineCost,
    });
  }

  return {
    materials,
    totalMaterialCost: roundMoney(totalMaterialCost),
  };
}

export function unitMaterialCost(
  totalMaterialCost: number,
  quantityProduced: number
): number {
  if (quantityProduced <= 0) return 0;
  return roundMoney(totalMaterialCost / quantityProduced);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
