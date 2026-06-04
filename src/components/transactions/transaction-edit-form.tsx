"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type {
  Appointment,
  PaymentMethod,
  PaymentReceipt,
  Sale,
  SaleType,
  TransactionListItem,
} from "@/domain/types";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type Props = {
  row: TransactionListItem;
  businessId: string;
  onCancel: () => void;
  onSaved: () => void;
  /** When set, PATCH includes status BOOKED (e.g. reopening a cancelled slot). */
  reopenOnSave?: boolean;
};

export function TransactionEditForm({
  row,
  businessId,
  onCancel,
  onSaved,
  reopenOnSave = false,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sale, setSale] = useState<Sale | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("IMMEDIATE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [downPayment, setDownPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(
    null
  );

  const total =
    row.kind === "SALE" ? (sale?.total ?? row.amount) : (appointment?.price ?? row.amount);
  const isCredit = saleType === "CREDIT";
  const paidNow = isCredit
    ? Math.min(Number(downPayment) || 0, total)
    : total;
  const outstanding = Math.max(0, total - paidNow);

  const payments =
    row.kind === "SALE"
      ? (sale?.payments ?? row.payments ?? [])
      : appointment
        ? resolveAppointmentPayments(appointment)
        : (row.payments ?? []);
  const paymentsLocked = payments.length > 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const url =
      row.kind === "SALE"
        ? `/api/sales/${row._id}`
        : `/api/appointments/${row._id}`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (row.kind === "SALE") {
          const s = json.data as Sale;
          setSale(s);
          setCustomerName(s.customer?.name ?? "");
          setCustomerPhone(s.customer?.phone ?? "");
          setCustomerEmail(s.customer?.email ?? "");
          setSaleType(s.saleType ?? "IMMEDIATE");
          setPaymentMethod(s.paymentMethod ?? "CASH");
          setDueDate(
            s.dueDate ? toLocalInput(new Date(s.dueDate)).slice(0, 10) : ""
          );
          setDownPayment(
            s.saleType === "CREDIT" && s.amountPaid > 0
              ? String(s.amountPaid)
              : ""
          );
          setPaymentReceipt(
            s.payments.find((p) => p.receipt)?.receipt ?? null
          );
        } else {
          const a = json.data as Appointment;
          setAppointment(a);
          setCustomerName(a.customerName);
          setCustomerPhone(a.customerPhone);
          setCustomerEmail(a.customerEmail ?? "");
          setStartAt(toLocalInput(new Date(a.startAt)));
          setEndAt(toLocalInput(new Date(a.endAt)));
          setFollowUpAt(
            a.followUpAt ? toLocalInput(new Date(a.followUpAt)).slice(0, 10) : ""
          );
          setNotes(a.notes ?? "");
          setSaleType(a.saleType ?? "IMMEDIATE");
          setPaymentMethod(a.paymentMethod ?? "CASH");
          setDueDate(
            a.dueDate ? toLocalInput(new Date(a.dueDate)).slice(0, 10) : ""
          );
          setDownPayment(
            a.saleType === "CREDIT" && (a.amountPaid ?? 0) > 0
              ? String(a.amountPaid)
              : ""
          );
          const resolved = resolveAppointmentPayments(a);
          setPaymentReceipt(
            resolved.find((p) => p.receipt)?.receipt ?? a.paymentReceipt ?? null
          );
        }
      })
      .catch(() => toast.error("Failed to load record"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (row.kind === "BOOKING") {
      if (!startAt || !endAt) {
        toast.error("Pick a start and end time");
        return;
      }
      if (new Date(endAt) <= new Date(startAt)) {
        toast.error("End time must be after start time");
        return;
      }
    }
    if (isCredit && !dueDate) {
      toast.error("A due date is required for credit");
      return;
    }

    const paymentFields = paymentsLocked
      ? {}
      : {
          saleType,
          paymentMethod,
          ...(isCredit && {
            amountPaid: paidNow,
            dueDate: new Date(dueDate).toISOString(),
          }),
          ...(paymentReceipt && { paymentReceipt }),
        };

    const body =
      row.kind === "SALE"
        ? {
            customer: {
              name: customerName.trim(),
              phone: customerPhone.trim(),
              email: customerEmail.trim() || undefined,
            },
            ...paymentFields,
          }
        : {
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim(),
            customerEmail: customerEmail.trim() || undefined,
            startAt: new Date(startAt).toISOString(),
            endAt: new Date(endAt).toISOString(),
            followUpAt: followUpAt
              ? new Date(followUpAt).toISOString()
              : undefined,
            notes: notes.trim() || undefined,
            ...(reopenOnSave ? { status: "BOOKED" as const } : {}),
            ...paymentFields,
          };

    setSaving(true);
    try {
      const url =
        row.kind === "SALE"
          ? `/api/sales/${row._id}`
          : `/api/appointments/${row._id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string" ? json.error : "Failed to save";
        throw new Error(message);
      }
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="px-4 text-sm text-muted-foreground">Loading…</p>;
  }

  const receiptCategory = row.kind === "SALE" ? "sales" : "appointments";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6">
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        {row.kind === "SALE" ? (
          <>Invoice <span className="font-mono text-foreground">{row.reference}</span> — line items cannot be changed here.</>
        ) : (
          <>Service <span className="font-medium text-foreground">{row.reference}</span></>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="tx-customer">Customer name</Label>
        <Input
          id="tx-customer"
          required
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tx-phone">Phone</Label>
        <Input
          id="tx-phone"
          type="tel"
          required
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tx-email">Email (optional)</Label>
        <Input
          id="tx-email"
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />
      </div>

      {row.kind === "BOOKING" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="tx-start">From</Label>
              <Input
                id="tx-start"
                type="datetime-local"
                required
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="tx-end">To</Label>
              <Input
                id="tx-end"
                type="datetime-local"
                required
                value={endAt}
                min={startAt || undefined}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-followup">Follow-up date (optional)</Label>
            <Input
              id="tx-followup"
              type="date"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tx-notes">Notes (optional)</Label>
            <Input
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </>
      )}

      {row.kind === "SALE" && sale?.items && sale.items.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Items</p>
          <ul className="divide-y rounded-lg border border-border/60 text-sm">
            {sale.items.map((item, i) => (
              <li
                key={i}
                className="flex justify-between gap-3 px-3 py-2"
              >
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span className="font-mono tabular-nums">
                  {item.lineTotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {paymentsLocked ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-3 text-sm">
          <p className="font-medium">Payment ledger locked</p>
          <p className="mt-1 text-muted-foreground">
            Multiple payments recorded — use{" "}
            <ButtonLink href="/receivables" variant="link" className="h-auto p-0">
              Receivables
            </ButtonLink>{" "}
            for balance collection.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Settlement</p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["IMMEDIATE", "CREDIT"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSaleType(t)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    saleType === t
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "IMMEDIATE" ? "Pay now" : "Pay later"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              {isCredit ? "Down payment method" : "Payment method"}
            </p>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              {(["CASH", "ONLINE"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    paymentMethod === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "CASH" ? "Cash" : "Online"}
                </button>
              ))}
            </div>
          </div>

          {isCredit && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="tx-due">Due date</Label>
                <Input
                  id="tx-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="tx-paid">Paid now (optional)</Label>
                <Input
                  id="tx-paid"
                  type="number"
                  min={0}
                  max={total}
                  step="0.01"
                  value={downPayment}
                  onChange={(e) => setDownPayment(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {isCredit ? "Outstanding" : "Total"}
            </span>
            <span className="font-mono font-semibold">
              {(isCredit ? outstanding : total).toFixed(2)}
            </span>
          </div>

          {businessId && (paidNow > 0 || !isCredit) && (
            <ReceiptUpload
              businessId={businessId}
              category={receiptCategory}
              value={paymentReceipt}
              onChange={setPaymentReceipt}
              id="tx-receipt"
              suggested={paymentMethod === "ONLINE" || paidNow > 0}
            />
          )}
        </>
      )}

      <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
