/** Client-safe receipt display helpers (no Cloudinary SDK). */

import type { PaymentReceipt, SalePayment } from "@/domain/types";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";

export function receiptThumbnailUrl(url: string, width = 120): string {
  if (!url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/c_limit,w_${width},h_${width},q_auto,f_auto/`);
}

export type ReceiptCategory = "sales" | "purchases" | "appointments";

export function receiptsFromPayments(payments?: SalePayment[]): PaymentReceipt[] {
  if (!payments?.length) return [];
  return payments.flatMap((payment) =>
    payment.receipt ? [payment.receipt] : []
  );
}

export function primaryTransactionReceipt(item: {
  kind: "SALE" | "BOOKING";
  paymentReceipt?: PaymentReceipt;
  payments?: SalePayment[];
  amountPaid?: number;
  paymentMethod?: "CASH" | "ONLINE";
  createdAt?: Date;
}): PaymentReceipt | undefined {
  if (item.kind === "BOOKING") {
    return (
      receiptsFromPayments(
        resolveAppointmentPayments({
          payments: item.payments,
          paymentReceipt: item.paymentReceipt,
          amountPaid: item.amountPaid,
          paymentMethod: item.paymentMethod,
          createdAt: item.createdAt ?? new Date(),
        })
      )[0] ?? item.paymentReceipt
    );
  }
  return receiptsFromPayments(item.payments)[0];
}

export function saleHasReceipt(payments?: SalePayment[]): boolean {
  return receiptsFromPayments(payments).length > 0;
}

