import type { Purchase, Supplier, SupplierDetail } from "@/domain/types";
import { AppError } from "@/lib/errors";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { supplierRepository } from "@/repositories/supplier.repository";
import { businessService } from "./business.service";

export const supplierService = {
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
  ): Promise<Supplier[] | PaginatedResult<Supplier>> {
    await businessService.getById(businessId);
    const activeOnly = options?.includeInactive !== true;
    if (options?.page != null && options?.pageSize != null) {
      return supplierRepository.findByBusinessPaginated(businessId, {
        search: options.search,
        activeOnly,
        sort: options.sort,
        dir: options.dir,
        page: options.page,
        pageSize: options.pageSize,
      });
    }
    return supplierRepository.findByBusiness(businessId, {
      search: options?.search,
      activeOnly,
    });
  },

  async getById(id: string): Promise<Supplier> {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) {
      throw new AppError("Supplier not found", 404, "NOT_FOUND");
    }
    return supplier;
  },

  async getDetail(id: string): Promise<SupplierDetail> {
    const supplier = await this.getById(id);
    await businessService.getById(supplier.businessId);
    const [stats, recentPurchases] = await Promise.all([
      supplierRepository.getStats(supplier.businessId, supplier._id),
      supplierRepository.findPurchasesPaginated(
        supplier.businessId,
        supplier._id,
        { page: 1, pageSize: 5 }
      ),
    ]);
    return {
      ...supplier,
      stats,
      recentPurchases: recentPurchases.items,
    };
  },

  async create(input: {
    businessId: string;
    name: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
  }): Promise<Supplier> {
    await businessService.getById(input.businessId);
    try {
      return await supplierRepository.create(input);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new AppError(
          "A supplier with this name already exists",
          409,
          "DUPLICATE_SUPPLIER"
        );
      }
      throw error;
    }
  },

  async update(
    id: string,
    input: Partial<{
      name: string;
      contactPerson: string;
      phone: string;
      email: string;
      address: string;
      notes: string;
      isActive: boolean;
    }>
  ): Promise<Supplier> {
    const existing = await this.getById(id);
    await businessService.getById(existing.businessId);
    try {
      const updated = await supplierRepository.update(id, input);
      if (!updated) {
        throw new AppError("Supplier not found", 404, "NOT_FOUND");
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
          "A supplier with this name already exists",
          409,
          "DUPLICATE_SUPPLIER"
        );
      }
      throw error;
    }
  },

  async listPurchases(
    id: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<PaginatedResult<Purchase>> {
    const supplier = await this.getById(id);
    return supplierRepository.findPurchasesPaginated(
      supplier.businessId,
      supplier._id,
      {
        page: options?.page ?? 1,
        pageSize: options?.pageSize ?? 20,
      }
    );
  },
};
