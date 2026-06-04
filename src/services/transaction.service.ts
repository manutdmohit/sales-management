import type { TransactionListItem } from "@/domain/types";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import {
  transactionRepository,
  type TransactionKindFilter,
} from "@/repositories/transaction.repository";
import { businessService } from "./business.service";

export const transactionService = {
  async list(
    businessId: string,
    options?: {
      kind?: TransactionKindFilter;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<TransactionListItem>> {
    await businessService.getById(businessId);
    return transactionRepository.findPaginated(businessId, {
      kind: options?.kind ?? "all",
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 15,
    });
  },
};
