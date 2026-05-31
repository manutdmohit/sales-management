import { AppError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/pagination";
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
    options?: {
      search?: string;
      includeInactive?: boolean;
      page?: number;
      pageSize?: number;
    }
  ): Promise<Product[] | PaginatedResult<Product>> {
    await businessService.getById(businessId);
    const activeOnly = options?.includeInactive !== true;
    const repoOptions = {
      search: options?.search,
      activeOnly,
    };
    if (options?.page != null && options?.pageSize != null) {
      return productRepository.findByBusinessPaginated(businessId, {
        ...repoOptions,
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
