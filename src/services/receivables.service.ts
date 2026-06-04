import type { Receivable } from "@/domain/types";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { receivableRepository } from "@/repositories/receivable.repository";
import { appointmentService } from "./appointment.service";
import { businessService } from "./business.service";
import { salesService } from "./sales.service";
import type { z } from "zod";
import type { recordPaymentSchema } from "@/schemas/sale.schema";

type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const receivablesService = {
  async list(
    businessId: string,
    options?: {
      outstandingOnly?: boolean;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<Receivable>> {
    await businessService.getById(businessId);
    return receivableRepository.findPaginated(businessId, {
      outstandingOnly: options?.outstandingOnly ?? false,
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 10,
    });
  },

  async recordPayment(
    source: Receivable["source"],
    id: string,
    input: RecordPaymentInput
  ) {
    if (source === "sale") {
      return salesService.recordPayment(id, input);
    }
    return appointmentService.recordPayment(id, input);
  },
};
