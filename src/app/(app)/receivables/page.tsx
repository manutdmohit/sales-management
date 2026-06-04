"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import type { PaymentMethod, PaymentReceipt, Receivable } from "@/domain/types";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import {
  ReceiptCell,
  SalePaymentHistory,
} from "@/components/receipts/payment-receipts";
import { receiptsFromPayments } from "@/lib/receipt-display";
import { formatDateYmd } from "@/lib/format-datetime";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function statusBadge(row: Receivable) {
  const overdue =
    row.creditStatus !== "PAID" &&
    row.dueDate != null &&
    new Date(row.dueDate) < new Date();
  if (overdue) return <Badge variant="destructive">Overdue</Badge>;
  if (row.creditStatus === "PAID") return <Badge variant="secondary">Paid</Badge>;
  if (row.creditStatus === "PARTIAL")
    return <Badge variant="outline">Partial</Badge>;
  return <Badge variant="outline">Pending</Badge>;
}

function sourceBadge(source: Receivable["source"]) {
  if (source === "booking") {
    return <Badge variant="secondary">Booking</Badge>;
  }
  return <Badge variant="outline">Product sale</Badge>;
}

function paymentEndpoint(row: Receivable): string {
  return row.source === "sale"
    ? `/api/sales/${row._id}/payment`
    : `/api/appointments/${row._id}/payment`;
}

function receiptCategory(row: Receivable): "sales" | "appointments" {
  return row.source === "sale" ? "sales" : "appointments";
}

export default function ReceivablesPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [outstandingOnly, setOutstandingOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("dueDate");
  const [dir, setDir] = useState<SortDir>("asc");
  const [active, setActive] = useState<Receivable | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const selectedBusiness = businesses.find((b) => b._id === businessId);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        outstandingOnly: String(outstandingOnly),
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/receivables?${params}`;
    },
    [businessId, outstandingOnly, search, sort, dir]
  );

  const {
    items: receivables,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<Receivable>(buildUrl, [
    businessId,
    outstandingOnly,
    search,
    sort,
    dir,
  ]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  function openPayment(row: Receivable) {
    setActive(row);
    setAmount(row.amountDue.toFixed(2));
    setMethod("CASH");
    setNote("");
    setPaymentReceipt(null);
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(paymentEndpoint(active), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          method,
          note: note.trim() || undefined,
          ...(paymentReceipt && { receipt: paymentReceipt }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string" ? json.error : "Failed to record payment";
        throw new Error(message);
      }
      const remaining = json.data.amountDue ?? 0;
      toast.success(
        remaining > 0
          ? `Payment recorded — ${remaining.toFixed(2)} remaining`
          : `Settled in full — ${active.reference}`
      );
      setActive(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Receivables</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Receivables</h2>
          <p className="text-muted-foreground">
            Outstanding credit from product sales and service bookings for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            .
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {[
            { v: true, label: "Outstanding" },
            { v: false, label: "All credit" },
          ].map(({ v, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setOutstandingOnly(v)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                outstandingOnly === v
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Input
        placeholder="Search by reference, customer name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <DataTable
        columns={[
          {
            id: "type",
            header: "Type",
            cell: (r) => sourceBadge(r.source),
          },
          {
            id: "reference",
            header: "Reference",
            sortKey: "createdAt",
            cell: (r) => (
              <div>
                <div
                  className={cn(
                    "font-medium",
                    r.source === "sale" && "font-mono text-sm"
                  )}
                >
                  {r.reference}
                </div>
                {r.appointmentDate && (
                  <div className="text-xs text-muted-foreground">
                    Appt {formatDateYmd(r.appointmentDate)}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            sortKey: "customer.name",
            cell: (r) => (
              <div>
                <div className="font-medium">{r.customerName}</div>
                {r.customerPhone && (
                  <div className="text-xs text-muted-foreground">
                    {r.customerPhone}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "due",
            header: "Due date",
            sortKey: "dueDate",
            cell: (r) => {
              if (!r.dueDate) return "—";
              const overdue =
                r.creditStatus !== "PAID" && new Date(r.dueDate) < new Date();
              return (
                <span className={cn(overdue && "font-medium text-destructive")}>
                  {formatDateYmd(r.dueDate)}
                </span>
              );
            },
          },
          {
            id: "total",
            header: "Total",
            sortKey: "total",
            headerClassName: "text-right",
            className: "text-right font-mono",
            cell: (r) => r.total.toFixed(2),
          },
          {
            id: "paid",
            header: "Paid",
            headerClassName: "text-right",
            className: "text-right font-mono text-muted-foreground",
            cell: (r) => r.amountPaid.toFixed(2),
          },
          {
            id: "dueAmt",
            header: "Outstanding",
            sortKey: "amountDue",
            headerClassName: "text-right",
            className: "text-right font-mono font-semibold",
            cell: (r) => r.amountDue.toFixed(2),
          },
          {
            id: "status",
            header: "Status",
            cell: (r) => statusBadge(r),
          },
          {
            id: "receipt",
            header: "Receipt",
            cell: (r) => (
              <ReceiptCell receipt={receiptsFromPayments(r.payments)[0]} />
            ),
          },
          {
            id: "actions",
            header: "Actions",
            headerClassName: "text-right",
            className: "text-right",
            cell: (r) => (
              <Button
                variant={r.amountDue > 0 ? "outline" : "ghost"}
                size="sm"
                onClick={() => openPayment(r)}
              >
                {r.amountDue > 0 ? "Record payment" : "View"}
              </Button>
            ),
          },
        ]}
        data={receivables}
        rowKey={(r) => `${r.source}:${r._id}`}
        loading={loading}
        emptyMessage={
          outstandingOnly
            ? "No outstanding credit balances. Nicely collected!"
            : "No credit sales or bookings yet."
        }
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
      />

      <Sheet open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent>
          <form onSubmit={handleRecordPayment} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {active && active.amountDue > 0 ? "Record payment" : "Credit balance"}
              </SheetTitle>
              <SheetDescription>
                {active && (
                  <>
                    {sourceBadge(active.source)}{" "}
                    {active.reference} — {active.customerName}
                    {active.amountDue > 0
                      ? `. Outstanding ${active.amountDue.toFixed(2)}.`
                      : ". Fully settled."}
                  </>
                )}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
              {active && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                  <dl className="space-y-1.5">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="font-mono font-medium">
                        {active.total.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Paid</dt>
                      <dd className="font-mono font-medium">
                        {active.amountPaid.toFixed(2)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Outstanding</dt>
                      <dd className="font-mono font-semibold">
                        {active.amountDue.toFixed(2)}
                      </dd>
                    </div>
                    {active.appointmentDate && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Appointment</dt>
                        <dd>{formatDateYmd(active.appointmentDate)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold">Payment history</h3>
                {!active || active.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded yet.
                  </p>
                ) : (
                  <SalePaymentHistory payments={active.payments} />
                )}
              </div>

              {active && active.amountDue > 0 && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="pay-amount">Amount</Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      min={0}
                      max={active.amountDue}
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-primary hover:underline"
                      onClick={() => setAmount(active.amountDue.toFixed(2))}
                    >
                      Pay full balance ({active.amountDue.toFixed(2)})
                    </button>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay-method">Method</Label>
                    <select
                      id="pay-method"
                      className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pay-note">Note (optional)</Label>
                    <Input
                      id="pay-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>
                  {businessId && active && (
                    <ReceiptUpload
                      businessId={businessId}
                      category={receiptCategory(active)}
                      value={paymentReceipt}
                      onChange={setPaymentReceipt}
                      id="pay-receipt"
                      suggested={method === "ONLINE"}
                    />
                  )}
                </div>
              )}
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setActive(null)}>
                {active && active.amountDue > 0 ? "Cancel" : "Close"}
              </Button>
              {active && active.amountDue > 0 && (
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Record payment"}
                </Button>
              )}
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
