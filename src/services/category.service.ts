import type { ProductCategory } from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { categoryRepository } from "@/repositories/category.repository";
import { businessService } from "./business.service";

export const categoryService = {
  async list(
    businessId: string,
    options?: {
      search?: string;
      includeInactive?: boolean;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<ProductCategory[] | PaginatedResult<ProductCategory>> {
    await businessService.getById(businessId);
    const activeOnly = options?.includeInactive !== true;
    if (options?.page != null && options?.pageSize != null) {
      return categoryRepository.findByBusinessPaginated(businessId, {
        search: options.search,
        activeOnly,
        sort: options.sort,
        dir: options.dir,
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return categoryRepository.findByBusiness(businessId, {
      search: options?.search,
      activeOnly,
    });
  },

  async getById(id: string): Promise<ProductCategory> {
    const category = await categoryRepository.findById(id);
    if (!category) {
      throw new AppError("Category not found", 404, "NOT_FOUND");
    }
    return category;
  },

  async assertForBusiness(
    businessId: string,
    categoryId: string
  ): Promise<ProductCategory> {
    const category = await this.getById(categoryId);
    if (category.businessId !== businessId) {
      throw new AppError("Category does not belong to business", 400);
    }
    if (!category.isActive) {
      throw new AppError("Category is inactive", 400);
    }
    return category;
  },

  async create(input: {
    businessId: string;
    name: string;
    slug: string;
    description?: string;
    sortOrder?: number;
  }): Promise<ProductCategory> {
    await businessService.getById(input.businessId);
    try {
      return await categoryRepository.create({
        ...input,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new AppError(
          "A category with this name or slug already exists",
          409,
          "DUPLICATE_CATEGORY"
        );
      }
      throw error;
    }
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      slug: string;
      description: string;
      sortOrder: number;
      isActive: boolean;
    }>
  ): Promise<ProductCategory> {
    const existing = await this.getById(id);
    await businessService.getById(existing.businessId);
    try {
      const updated = await categoryRepository.update(id, input);
      if (!updated) {
        throw new AppError("Category not found", 404, "NOT_FOUND");
      }
      return updated;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new AppError(
          "A category with this name or slug already exists",
          409,
          "DUPLICATE_CATEGORY"
        );
      }
      throw error;
    }
  },
};
