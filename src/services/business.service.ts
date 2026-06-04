import { AppError } from "@/lib/errors";
import type { PaginatedResult } from "@/lib/pagination";
import { businessRepository } from "@/repositories/business.repository";
import { productRepository } from "@/repositories/product.repository";
import type { Business } from "@/domain/types";
import type { z } from "zod";
import type {
  createBusinessSchema,
  updateBusinessSchema,
} from "@/schemas/business.schema";

type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;

export const businessService = {
  async list(options?: {
    includeInactive?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<Business[] | PaginatedResult<Business>> {
    const activeOnly = options?.includeInactive !== true;
    if (options?.page != null && options?.pageSize != null) {
      return businessRepository.findAllPaginated(
        activeOnly,
        options.page,
        options.pageSize
      );
    }
    return businessRepository.findAll(activeOnly);
  },

  async getById(id: string): Promise<Business> {
    const business = await businessRepository.findById(id);
    if (!business) throw new AppError("Business not found", 404, "NOT_FOUND");
    return business;
  },

  async create(input: CreateBusinessInput): Promise<Business> {
    const existing = await businessRepository.findBySlug(input.slug);
    if (existing) {
      throw new AppError("Business slug already exists", 409, "DUPLICATE_SLUG");
    }
    return businessRepository.create({
      name: input.name,
      slug: input.slug,
      code: input.code,
      type: input.type ?? "GENERAL",
      isActive: input.isActive ?? true,
      settings: input.settings ?? {},
    });
  },

  async update(id: string, input: UpdateBusinessInput): Promise<Business> {
    const existing = await this.getById(id);
    const patch: UpdateBusinessInput = { ...input };
    if (input.settings) {
      patch.settings = { ...existing.settings, ...input.settings };
    }
    const business = await businessRepository.update(id, patch);
    if (!business) throw new AppError("Business not found", 404, "NOT_FOUND");
    if (input.type) {
      await productRepository.syncBusinessType(id, input.type);
    }
    return business;
  },

  async deactivate(id: string): Promise<Business> {
    return this.update(id, { isActive: false });
  },
};
