import { AppError } from "@/lib/errors";
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
  async list(options?: { includeInactive?: boolean }): Promise<Business[]> {
    return businessRepository.findAll(options?.includeInactive !== true);
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
    await this.getById(id);
    const business = await businessRepository.update(id, input);
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
