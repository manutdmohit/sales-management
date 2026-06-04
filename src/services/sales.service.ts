import type { CreditStatus, Sale, SaleItem } from "@/domain/types";
import { AppError } from "@/lib/errors";
import { eventBus } from "@/lib/events/event-bus";
import {
  assertReceiptBelongsToBusiness,
} from "@/lib/cloudinary";
import {
  lineCostFromUnitCost,
  resolveProductUnitCost,
} from "@/lib/inventory-cost";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { batchRepository } from "@/repositories/batch.repository";
import { businessService } from "./business.service";
import { clientService } from "./client.service";
import { inventoryService } from "./inventory.service";
import { productService } from "./product.service";
import type { z } from "zod";
import type {
  createSaleSchema,
  recordPaymentSchema,
  updateSaleSchema,
} from "@/schemas/sale.schema";
import {
  applySettlementUpdate,
  deriveCreditStatus,
} from "@/lib/settlement-update";

type CreateSaleInput = z.infer<typeof createSaleSchema>;
type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
type UpdateSaleInput = z.infer<typeof updateSaleSchema>;

export const salesService = {
  async getById(id: string): Promise<Sale> {
    const sale = await saleRepository.findById(id);
    if (!sale) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }
    return sale;
  },

  async list(businessId: string): Promise<Sale[]> {
    await businessService.getById(businessId);
    return saleRepository.findByBusiness(businessId);
  },

  async listReceivables(
    businessId: string,
    options?: {
      outstandingOnly?: boolean;
      search?: string;
      sort?: string;
      dir?: SortDir;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<Sale>> {
    await businessService.getById(businessId);
    return saleRepository.findReceivablesPaginated(businessId, {
      outstandingOnly: options?.outstandingOnly ?? false,
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 10,
    });
  },

  async create(input: CreateSaleInput): Promise<Sale> {
    const business = await businessService.getById(input.businessId);

    for (const item of input.items) {
      await inventoryService.validateAvailability(
        input.businessId,
        item.productId,
        item.quantity
      );
    }

    const saleItems: SaleItem[] = [];
    let subtotal = 0;
    let totalCost = 0;

    for (const item of input.items) {
      const product = await productService.getById(item.productId);
      if (product.businessId !== input.businessId) {
        throw new AppError("Product does not belong to business", 400);
      }
      const unitPrice = item.unitPrice ?? product.pricing.selling;
      const lineTotal = unitPrice * item.quantity;
      const unitCost = resolveProductUnitCost(product);
      const lineCost = lineCostFromUnitCost(unitCost, item.quantity);
      subtotal += lineTotal;
      totalCost += lineCost;
      saleItems.push({
        productId: product._id,
        productName: product.name,
        batchId: item.batchId,
        quantity: item.quantity,
        unitPrice,
        lineTotal,
        unitCost,
        lineCost,
      });
    }

    const discount = input.discount ?? 0;
    const tax = input.tax ?? 0;
    const total = Math.max(0, subtotal - discount + tax);

    const prefix = business.settings.invoicePrefix ?? business.code;
    const count = await saleRepository.countByBusiness(input.businessId);
    const invoiceNumber = `${prefix}-${String(count + 1).padStart(6, "0")}`;

    // Link this sale to a client record so it shows in their purchase history.
    let clientId: string | undefined;
    if (input.customer?.phone?.trim()) {
      const client = await clientService.upsertFromContact({
        businessId: input.businessId,
        name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email,
      });
      clientId = client._id;
    }

    const isCredit = input.saleType === "CREDIT";
    // Cash sales are settled in full immediately; credit sales may carry a
    // down-payment that is clamped to the invoice total.
    const downPayment = isCredit ? Math.min(input.amountPaid ?? 0, total) : total;
    const amountPaid = downPayment;
    const amountDue = Math.max(0, total - amountPaid);
    const creditStatus = isCredit
      ? deriveCreditStatus(total, amountPaid)
      : undefined;
    const now = new Date();

    if (input.paymentReceipt) {
      assertReceiptBelongsToBusiness(
        input.paymentReceipt,
        input.businessId,
        "sales"
      );
    }

    const sale = await saleRepository.create({
      businessId: input.businessId,
      invoiceNumber,
      items: saleItems,
      subtotal,
      discount,
      tax,
      total,
      totalCost,
      paymentMethod: input.paymentMethod,
      saleType: input.saleType,
      customer: input.customer,
      clientId,
      dueDate: input.dueDate,
      amountPaid,
      amountDue,
      creditStatus,
      payments:
        amountPaid > 0
          ? [
              {
                amount: amountPaid,
                method: input.paymentMethod,
                at: now,
                ...(input.paymentReceipt && { receipt: input.paymentReceipt }),
              },
            ]
          : [],
      createdAt: now,
    });

    const timestamp = new Date();
    const transactions = saleItems.map((item) => ({
      businessId: input.businessId,
      productId: item.productId,
      batchId: item.batchId,
      type: "SALE" as const,
      quantity: item.quantity,
      referenceId: sale._id,
      timestamp,
    }));
    await inventoryRepository.createMany(transactions);

    for (const item of saleItems) {
      if (item.batchId) {
        const updated = await batchRepository.decrementRemaining(
          item.batchId,
          item.quantity
        );
        if (!updated) {
          throw new AppError("Batch stock insufficient", 409);
        }
      }
      await eventBus.emit({
        type: "STOCK_UPDATED",
        businessId: input.businessId,
        payload: { productId: item.productId, saleId: sale._id },
        timestamp: new Date(),
      });
    }

    await eventBus.emit({
      type: "SALE_CREATED",
      businessId: input.businessId,
      payload: {
        saleId: sale._id,
        invoiceNumber,
        total,
        saleType: input.saleType,
        paymentMethod: input.paymentMethod,
        customer: sale.customer,
        items: saleItems
          .map((i) => `${i.productName} x${i.quantity} @ ${i.unitPrice.toFixed(2)}`)
          .join("\n"),
      },
      timestamp: new Date(),
    });

    if (isCredit) {
      await eventBus.emit({
        type: "CREDIT_SALE_CREATED",
        businessId: input.businessId,
        payload: {
          saleId: sale._id,
          invoiceNumber,
          total,
          amountPaid,
          amountDue,
          dueDate: sale.dueDate,
          customer: sale.customer,
        },
        timestamp: new Date(),
      });
    }

    return sale;
  },

  /** Update customer and settlement on an existing sale (line items are fixed). */
  async update(id: string, input: UpdateSaleInput): Promise<Sale> {
    const existing = await saleRepository.findById(id);
    if (!existing) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }

    let clientId = existing.clientId;
    if (input.customer) {
      const client = await clientService.upsertFromContact({
        businessId: existing.businessId,
        name: input.customer.name,
        phone: input.customer.phone,
        email: input.customer.email,
      });
      clientId = client._id;
    }

    const settlement = applySettlementUpdate({
      total: existing.total,
      existing: {
        saleType: existing.saleType,
        paymentMethod: existing.paymentMethod,
        amountPaid: existing.amountPaid,
        dueDate: existing.dueDate,
        payments: existing.payments,
      },
      input: {
        saleType: input.saleType,
        paymentMethod: input.paymentMethod,
        amountPaid: input.amountPaid,
        dueDate: input.dueDate,
        paymentReceipt: input.paymentReceipt,
      },
      businessId: existing.businessId,
      receiptCategory: "sales",
    });

    const updated = await saleRepository.update(id, {
      ...(input.customer ? { customer: input.customer, clientId } : {}),
      ...(settlement ?? {}),
    });
    if (!updated) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }
    return updated;
  },

  /** Record a payment against a credit sale and recompute its balance. */
  async recordPayment(
    saleId: string,
    input: RecordPaymentInput
  ): Promise<Sale> {
    const sale = await saleRepository.findById(saleId);
    if (!sale) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }
    if (sale.saleType !== "CREDIT") {
      throw new AppError("Only credit sales accept payments", 400);
    }
    if (sale.amountDue <= 0) {
      throw new AppError("This sale is already fully paid", 400);
    }
    if (input.amount > sale.amountDue + 1e-6) {
      throw new AppError(
        `Payment exceeds the outstanding balance of ${sale.amountDue.toFixed(2)}`,
        400
      );
    }

    const amountPaid = sale.amountPaid + input.amount;
    const amountDue = Math.max(0, sale.total - amountPaid);
    const creditStatus = deriveCreditStatus(sale.total, amountPaid);
    if (input.receipt) {
      assertReceiptBelongsToBusiness(input.receipt, sale.businessId, "sales");
    }
    const payment = {
      amount: input.amount,
      method: input.method,
      at: new Date(),
      note: input.note,
      ...(input.receipt && { receipt: input.receipt }),
    };

    const updated = await saleRepository.update(saleId, {
      amountPaid,
      amountDue,
      creditStatus,
      payments: [...sale.payments, payment],
    });
    if (!updated) {
      throw new AppError("Sale not found", 404, "NOT_FOUND");
    }

    await eventBus.emit({
      type: "PAYMENT_RECORDED",
      businessId: sale.businessId,
      payload: {
        saleId,
        amount: input.amount,
        amountDue,
        creditStatus,
        method: input.method,
      },
      timestamp: new Date(),
    });

    return updated;
  },
};
