import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import type { Service } from "@/domain/types";
import { serviceRepository } from "@/repositories/service.repository";
import { businessService } from "./business.service";
import type { z } from "zod";
import type {
  createServiceSchema,
  updateServiceSchema,
} from "@/schemas/service.schema";

type CreateServiceInput = z.infer<typeof createServiceSchema>;
type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const serviceCatalogService = {
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
  ): Promise<Service[] | PaginatedResult<Service>> {
    await businessService.getById(businessId);
    const activeOnly = options?.includeInactive !== true;
    if (options?.page != null && options?.pageSize != null) {
      return serviceRepository.findByBusinessPaginated(businessId, {
        search: options.search,
        activeOnly,
        sort: options.sort,
        dir: options.dir,
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return serviceRepository.findByBusiness(businessId, {
      search: options?.search,
      activeOnly,
    });
  },

  async getById(id: string): Promise<Service> {
    const service = await serviceRepository.findById(id);
    if (!service) throw new AppError("Service not found", 404, "NOT_FOUND");
    return service;
  },

  async create(input: CreateServiceInput): Promise<Service> {
    await businessService.getById(input.businessId);
    return serviceRepository.create({
      businessId: input.businessId,
      name: input.name,
      category: input.category,
      price: input.price,
      durationMinutes: input.durationMinutes,
      isActive: input.isActive ?? true,
    });
  },

  async update(id: string, input: UpdateServiceInput): Promise<Service> {
    const updated = await serviceRepository.update(id, input);
    if (!updated) throw new AppError("Service not found", 404, "NOT_FOUND");
    return updated;
  },
};
