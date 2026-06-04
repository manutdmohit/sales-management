"use client";

import type { PaymentReceipt, SalePayment } from "@/domain/types";
import { formatDateTimeYmd } from "@/lib/format-datetime";
import {
  primaryTransactionReceipt,
  receiptsFromPayments,
} from "@/lib/receipt-display";
import { Badge } from "@/components/ui/badge";
import { ReceiptThumb } from "@/components/receipts/receipt-thumb";

export function ReceiptCell({ receipt }: { receipt?: PaymentReceipt }) {
  if (!receipt) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <ReceiptThumb receipt={receipt} />;
}

export function TransactionReceiptCell({
  kind,
  paymentReceipt,
  payments,
}: {
  kind: "SALE" | "BOOKING";
  paymentReceipt?: PaymentReceipt;
  payments?: SalePayment[];
}) {
  return (
    <ReceiptCell
      receipt={primaryTransactionReceipt({ kind, paymentReceipt, payments })}
    />
  );
}

export function SalePaymentHistory({
  payments,
}: {
  payments?: SalePayment[];
}) {
  if (!payments?.length) {
    return (
      <p className="text-sm text-muted-foreground">No payments recorded.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {payments.map((payment, index) => (
        <li
          key={index}
          className="flex items-start justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
        >
          <div>
            <p className="font-mono font-medium">{payment.amount.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">
              {formatDateTimeYmd(payment.at)}
              {payment.note ? ` — ${payment.note}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {payment.receipt && <ReceiptThumb receipt={payment.receipt} />}
            <Badge variant="outline">
              {payment.method === "ONLINE" ? "Online" : "Cash"}
            </Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TransactionReceiptsSection({
  kind,
  paymentReceipt,
  payments,
}: {
  kind: "SALE" | "BOOKING";
  paymentReceipt?: PaymentReceipt;
  payments?: SalePayment[];
}) {
  if (kind === "BOOKING") {
    if (!paymentReceipt) return null;
    return (
      <div>
        <h3 className="mb-2 text-sm font-semibold">Payment receipt</h3>
        <ReceiptThumb receipt={paymentReceipt} size={80} />
      </div>
    );
  }

  const receipts = receiptsFromPayments(payments);
  if (!payments?.length && receipts.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Payments</h3>
      <SalePaymentHistory payments={payments} />
    </div>
  );
}

export function PurchaseReceiptsSection({
  receipts,
}: {
  receipts?: PaymentReceipt[];
}) {
  if (!receipts?.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Receipts</h3>
      <div className="flex flex-wrap gap-2">
        {receipts.map((receipt, index) => (
          <ReceiptThumb key={receipt.publicId ?? index} receipt={receipt} size={72} />
        ))}
      </div>
    </div>
  );
}
