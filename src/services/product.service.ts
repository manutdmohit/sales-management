import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { resolveUnitId } from "@/domain/units";
import { productRepository } from "@/repositories/product.repository";
import { businessService } from "./business.service";
import type { Product, ProductKind, ProductRecipeLine } from "@/domain/types";
import type { z } from "zod";
import type {
  createProductSchema,
  updateProductSchema,
} from "@/schemas/product.schema";
import { validateProductRecipe } from "@/lib/product-recipe";
import { categoryService } from "./category.service";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productService = {
  async list(
    businessId: string,
    options?: {
      search?: string;
      includeInactive?: boolean;
      productKind?: ProductKind;
      categoryId?: string;
      uncategorized?: boolean;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<Product[] | PaginatedResult<Product>> {
    await businessService.getById(businessId);
    const activeOnly = options?.includeInactive !== true;
    const repoOptions = {
      search: options?.search,
      activeOnly,
      productKind: options?.productKind,
      categoryId: options?.categoryId,
      uncategorized: options?.uncategorized,
    };
    if (options?.page != null && options?.pageSize != null) {
      return productRepository.findByBusinessPaginated(businessId, {
        ...repoOptions,
        sort: options.sort,
        dir: options.dir,
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return productRepository.findByBusiness(businessId, repoOptions);
  },

  async getById(id: string): Promise<Product> {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    return product;
  },

  async create(input: CreateProductInput): Promise<Product> {
    const business = await businessService.getById(input.businessId);
    if (input.categoryId) {
      await categoryService.assertForBusiness(
        input.businessId,
        input.categoryId
      );
    }
    const productKind = input.productKind ?? "FINISHED";
    const recipe = await validateProductRecipe(
      input.businessId,
      productKind,
      input.recipe
    );
    return productRepository.create({
      ...input,
      categoryId: input.categoryId ?? undefined,
      productKind,
      unitId: resolveUnitId(input.unitId, productKind),
      recipe,
      businessType: input.businessType ?? business.type,
    });
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.getById(id);
    if (input.categoryId) {
      await categoryService.assertForBusiness(
        existing.businessId,
        input.categoryId
      );
    }
    const productKind = input.productKind ?? existing.productKind;
    const recipeInput =
      input.recipe !== undefined ? input.recipe : existing.recipe;
    const recipe = await validateProductRecipe(
      existing.businessId,
      productKind,
      recipeInput
    );

    const patch: UpdateProductInput & { recipe?: ProductRecipeLine[] } = {
      ...input,
    };
    if (input.categoryId === null || input.categoryId === "") {
      (patch as { categoryId?: string | null }).categoryId = null;
    }
    if (input.productKind !== undefined || input.recipe !== undefined) {
      patch.productKind = productKind;
      patch.recipe = recipe;
    }
    if (productKind === "RAW") {
      patch.recipe = undefined;
    }
    if (input.unitId !== undefined || input.productKind !== undefined) {
      patch.unitId = resolveUnitId(
        input.unitId ?? existing.unitId,
        productKind
      );
    }

    const updated = await productRepository.update(
      id,
      patch as Parameters<typeof productRepository.update>[1]
    );
    if (!updated) throw new AppError("Product not found", 404, "NOT_FOUND");
    return updated;
  },
};
