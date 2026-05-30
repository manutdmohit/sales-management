import { AppError } from "@/lib/errors";
import { productRepository } from "@/repositories/product.repository";
import { businessService } from "./business.service";
import type { Product } from "@/domain/types";
import type { z } from "zod";
import type {
  createProductSchema,
  updateProductSchema,
} from "@/schemas/product.schema";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productService = {
  async list(
    businessId: string,
    options?: { search?: string; includeInactive?: boolean }
  ): Promise<Product[]> {
    await businessService.getById(businessId);
    return productRepository.findByBusiness(businessId, {
      search: options?.search,
      activeOnly: options?.includeInactive !== true,
    });
  },

  async getById(id: string): Promise<Product> {
    const product = await productRepository.findById(id);
    if (!product) throw new AppError("Product not found", 404, "NOT_FOUND");
    return product;
  },

  async create(input: CreateProductInput): Promise<Product> {
    const business = await businessService.getById(input.businessId);
    return productRepository.create({
      ...input,
      businessType: input.businessType ?? business.type,
    });
  },

  async update(id: string, input: UpdateProductInput): Promise<Product> {
    const updated = await productRepository.update(id, input);
    if (!updated) throw new AppError("Product not found", 404, "NOT_FOUND");
    return updated;
  },
};
