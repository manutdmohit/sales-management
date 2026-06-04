import type {
  CreditStatus,
  PaymentMethod,
  PaymentReceipt,
  SalePayment,
  SaleType,
} from "@/domain/types";
import { AppError } from "@/lib/errors";
import {
  assertReceiptBelongsToBusiness,
  type ReceiptCategory,
} from "@/lib/cloudinary";

export function deriveCreditStatus(
  total: number,
  amountPaid: number
): CreditStatus {
  if (amountPaid >= total) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "PENDING";
}

export type SettlementInput = {
  saleType?: SaleType;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  dueDate?: Date;
  paymentReceipt?: PaymentReceipt;
};

export function hasSettlementInput(input: SettlementInput): boolean {
  return (
    input.saleType !== undefined ||
    input.paymentMethod !== undefined ||
    input.amountPaid !== undefined ||
    input.dueDate !== undefined ||
    input.paymentReceipt !== undefined
  );
}

/** Recompute pay-now / credit settlement for a fixed total. */
export function applySettlementUpdate(options: {
  total: number;
  existing: {
    saleType?: SaleType;
    paymentMethod?: PaymentMethod;
    amountPaid?: number;
    dueDate?: Date;
    paymentReceipt?: PaymentReceipt;
    payments: SalePayment[];
  };
  input: SettlementInput;
  businessId: string;
  receiptCategory: ReceiptCategory;
}): {
  saleType: SaleType;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  amountDue: number;
  creditStatus?: CreditStatus;
  dueDate?: Date;
  payments: SalePayment[];
  paymentReceipt?: PaymentReceipt;
} | null {
  if (!hasSettlementInput(options.input)) return null;

  const { existing, input, total, businessId, receiptCategory } = options;
  if (existing.payments.length > 1) {
    throw new AppError(
      "Multiple payments were recorded. Use Receivables to collect the balance.",
      400
    );
  }

  const saleType = input.saleType ?? existing.saleType ?? "IMMEDIATE";
  const isCredit = saleType === "CREDIT";
  const paymentMethod = input.paymentMethod ?? existing.paymentMethod ?? "CASH";
  const dueDate = input.dueDate ?? existing.dueDate;

  if (isCredit && !dueDate) {
    throw new AppError("A due date is required for a credit sale", 400);
  }

  const amountPaid = isCredit
    ? Math.min(input.amountPaid ?? existing.amountPaid ?? 0, total)
    : total;
  const amountDue = Math.max(0, total - amountPaid);
  const creditStatus: CreditStatus | undefined = isCredit
    ? deriveCreditStatus(total, amountPaid)
    : undefined;

  if (input.paymentReceipt) {
    assertReceiptBelongsToBusiness(
      input.paymentReceipt,
      businessId,
      receiptCategory
    );
  }

  const receipt =
    input.paymentReceipt ??
    existing.payments[0]?.receipt ??
    existing.paymentReceipt;

  const payments =
    amountPaid > 0
      ? [
          {
            amount: amountPaid,
            method: paymentMethod,
            at: existing.payments[0]?.at ?? new Date(),
            ...(receipt && { receipt }),
          },
        ]
      : [];

  return {
    saleType,
    paymentMethod,
    amountPaid,
    amountDue,
    creditStatus,
    dueDate: isCredit ? dueDate : undefined,
    payments,
    paymentReceipt: receipt,
  };
}
