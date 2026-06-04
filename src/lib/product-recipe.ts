import type { ProductKind, ProductRecipeLine } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { productRepository } from "@/repositories/product.repository";

export async function validateProductRecipe(
  businessId: string,
  productKind: ProductKind,
  recipe?: ProductRecipeLine[]
): Promise<ProductRecipeLine[] | undefined> {
  if (productKind === "RAW") {
    if (recipe && recipe.length > 0) {
      throw new AppError("Raw materials cannot have a recipe", 400);
    }
    return undefined;
  }

  if (!recipe || recipe.length === 0) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: ProductRecipeLine[] = [];

  for (const line of recipe) {
    if (seen.has(line.rawProductId)) {
      throw new AppError("Duplicate raw material in recipe", 400);
    }
    seen.add(line.rawProductId);

    const raw = await productRepository.findById(line.rawProductId);
    if (!raw || raw.businessId !== businessId) {
      throw new AppError("Recipe raw material not found", 400);
    }
    if (raw.productKind !== "RAW") {
      throw new AppError(
        `Recipe ingredient "${raw.name}" must be a raw material`,
        400
      );
    }
    if (line.quantityPerUnit <= 0) {
      throw new AppError("Recipe quantities must be positive", 400);
    }

    normalized.push({
      rawProductId: raw._id,
      rawProductName: raw.name,
      rawUnitId: raw.unitId,
      quantityPerUnit: line.quantityPerUnit,
    });
  }

  return normalized;
}
