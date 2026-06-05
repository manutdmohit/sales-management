"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useBusiness } from "@/lib/business-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { hasFeature } from "@/domain/capabilities";
import type {
  AppointmentStatus,
  TransactionListItem,
} from "@/domain/types";
import {
  TransactionReceiptCell,
  TransactionReceiptsSection,
} from "@/components/receipts/payment-receipts";
import { TransactionEditForm } from "@/components/transactions/transaction-edit-form";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  ListPageHeader,
  MobileFilterPanel,
  MobileSearchField,
} from "@/components/ui/mobile-list-toolbar";
import { cn } from "@/lib/utils";
import {
  formatAppointmentSlot,
  formatDateTimeYmd,
  formatSaleTimestamp,
} from "@/lib/format-datetime";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type KindFilter = "all" | "sale" | "booking";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

function money(n: number): string {
  return n.toFixed(2);
}

function bookingStatusVariant(
  status: AppointmentStatus
): "secondary" | "outline" | "destructive" {
  if (status === "COMPLETED") return "secondary";
  if (status === "CANCELLED" || status === "NO_SHOW") return "destructive";
  return "outline";
}

function paymentLabel(row: TransactionListItem): string {
  if (row.kind === "BOOKING") {
    if (row.saleType === "CREDIT") return "Credit";
    return row.paymentMethod === "ONLINE" ? "Online" : "Cash";
  }
  if (row.saleType === "CREDIT") {
    if (row.creditStatus === "PAID") return "Credit · paid";
    if (row.creditStatus === "PARTIAL") return "Credit · partial";
    return "Credit · pending";
  }
  return row.paymentMethod === "ONLINE" ? "Online" : "Cash";
}

function kindBadge(row: TransactionListItem) {
  if (row.kind === "SALE") {
    return <Badge variant="outline">Product sale</Badge>;
  }
  return <Badge variant="secondary">Booking</Badge>;
}

function whenCell(row: TransactionListItem) {
  if (row.kind === "BOOKING" && row.startAt && row.endAt) {
    const { date, timeRange } = formatAppointmentSlot(row.startAt, row.endAt);
    return (
      <div>
        <div className="font-medium">{date}</div>
        <div className="text-xs text-muted-foreground">{timeRange}</div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Appointment
        </div>
      </div>
    );
  }

  const { date, time } = formatSaleTimestamp(row.occurredAt);
  return (
    <div>
      <div className="font-medium">{date}</div>
      <div className="text-xs text-muted-foreground">{time}</div>
      {row.kind === "SALE" && (
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Sold
        </div>
      )}
    </div>
  );
}

export default function SalesLedgerPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const servicesEnabled = hasFeature(selectedBusiness?.type, "appointments");

  const [kind, setKind] = useState<KindFilter>(
    servicesEnabled ? "all" : "sale"
  );
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<TransactionListItem | null>(null);
  const [editing, setEditing] = useState(false);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        kind,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      return `/api/transactions?${params}`;
    },
    [businessId, kind, search]
  );

  const {
    items: transactions,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<TransactionListItem>(buildUrl, [
    businessId,
    kind,
    search,
  ]);

  const kindTabs: { id: KindFilter; label: string }[] = servicesEnabled
    ? [
        { id: "all", label: "All" },
        { id: "sale", label: "Product sales" },
        { id: "booking", label: "Bookings" },
      ]
    : [{ id: "sale", label: "Product sales" }];

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Sales & bookings</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  function statusBadge(row: TransactionListItem) {
    if (row.kind === "BOOKING" && row.status) {
      return (
        <Badge variant={bookingStatusVariant(row.status)}>
          {STATUS_LABELS[row.status]}
        </Badge>
      );
    }
    if (row.saleType === "CREDIT" && row.creditStatus) {
      return (
        <Badge variant={row.creditStatus === "PAID" ? "secondary" : "outline"}>
          {row.creditStatus === "PAID"
            ? "Settled"
            : row.creditStatus === "PARTIAL"
              ? "Partial"
              : "Outstanding"}
        </Badge>
      );
    }
    return <Badge variant="secondary">Paid</Badge>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Sales & bookings"
        descriptionMobile={`Ledger for ${selectedBusiness?.name ?? "this business"}.`}
        description={
          <>
            Every product sale and service booking in one place for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            . Reports still offer period analytics — this is your day-to-day ledger.
          </>
        }
      />

      <MobileFilterPanel>
        <div className="flex flex-col gap-3">
          {kindTabs.length > 1 && (
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {kindTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setKind(tab.id)}
                  className={cn(
                    "cursor-pointer rounded-md px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
                    kind === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <MobileSearchField
            id="sales-search"
            placeholder="Search customer, invoice, service…"
            value={search}
            onChange={setSearch}
            onPageReset={() => setPage(1)}
          />
        </div>
      </MobileFilterPanel>

      <DataTable
        columns={[
          {
            id: "when",
            header: "When",
            hideOnMobile: true,
            cell: (row) => whenCell(row),
          },
          {
            id: "type",
            header: "Type",
            hideOnMobile: true,
            cell: (row) => kindBadge(row),
          },
          {
            id: "reference",
            header: "Reference",
            mobilePrimary: true,
            cell: (row) => (
              <div>
                <div
                  className={cn(
                    row.kind === "SALE" && "font-mono text-sm",
                    "font-medium"
                  )}
                >
                  {row.reference}
                </div>
                <div className="text-xs text-muted-foreground">{row.detail}</div>
              </div>
            ),
          },
          {
            id: "customer",
            header: "Customer",
            cell: (row) => (
              <div>
                {row.clientId ? (
                  <Link
                    href={`/clients/${row.clientId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.customerName}
                  </Link>
                ) : (
                  <div className="font-medium">{row.customerName}</div>
                )}
                {row.customerPhone && (
                  <div className="text-xs text-muted-foreground">
                    {row.customerPhone}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "payment",
            header: "Payment",
            hideOnMobile: true,
            cell: (row) => (
              <span className="text-sm text-muted-foreground">
                {paymentLabel(row)}
              </span>
            ),
          },
          {
            id: "amount",
            header: "Amount",
            headerClassName: "text-right",
            className: "text-right font-mono font-semibold",
            cell: (row) => money(row.amount),
          },
          {
            id: "receipt",
            header: "Receipt",
            hideOnMobile: true,
            cell: (row) => (
              <TransactionReceiptCell
                kind={row.kind}
                paymentReceipt={row.paymentReceipt}
                payments={row.payments}
              />
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (row) => statusBadge(row),
          },
          {
            id: "actions",
            header: "",
            mobileActions: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (row) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    setActive(row);
                  }}
                >
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setActive(row);
                  }}
                >
                  Edit
                </Button>
              </div>
            ),
          },
        ]}
        data={transactions}
        rowKey={(row) => `${row.kind}-${row._id}`}
        loading={loading}
        emptyMessage={
          kind === "booking"
            ? "No bookings yet."
            : kind === "sale"
              ? "No product sales yet. Complete a checkout in POS."
              : "No sales or bookings yet."
        }
        meta={meta}
        onPageChange={setPage}
      />

      <Sheet
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActive(null);
            setEditing(false);
          }
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editing
                ? active?.kind === "SALE"
                  ? "Edit product sale"
                  : "Edit booking"
                : active?.kind === "SALE"
                  ? "Product sale"
                  : "Service booking"}
            </SheetTitle>
            <SheetDescription>
              {active?.reference} — {active?.customerName}
            </SheetDescription>
          </SheetHeader>

          {active && editing && businessId && (
            <TransactionEditForm
              row={active}
              businessId={businessId}
              onCancel={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                setActive(null);
                await reload();
              }}
            />
          )}

          {active && !editing && (
            <div className="space-y-5 px-4 pb-6">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                <dl className="space-y-2">
                  {active.kind === "BOOKING" && active.startAt && active.endAt ? (
                    <>
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Appointment</dt>
                        <dd className="text-right">
                          {formatAppointmentSlot(active.startAt, active.endAt).date}
                          <br />
                          <span className="text-muted-foreground">
                            {formatAppointmentSlot(active.startAt, active.endAt).timeRange}
                          </span>
                        </dd>
                      </div>
                      {active.bookedAt && (
                        <div className="flex justify-between gap-4">
                          <dt className="text-muted-foreground">Booked on</dt>
                          <dd>{formatDateTimeYmd(active.bookedAt)}</dd>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Sold on</dt>
                      <dd>{formatDateTimeYmd(active.occurredAt)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-mono font-semibold">
                      {money(active.amount)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>{paymentLabel(active)}</dd>
                  </div>
                  {active.clientId && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Client profile</dt>
                      <dd>
                        <Link
                          href={`/clients/${active.clientId}`}
                          className="text-primary hover:underline"
                        >
                          View client
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {active.kind === "SALE" && active.items && active.items.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Items</h3>
                  <ul className="divide-y rounded-lg border border-border/60">
                    {active.items.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span>
                          {item.productName} × {item.quantity}
                        </span>
                        <span className="font-mono tabular-nums">
                          {money(item.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <TransactionReceiptsSection
                kind={active.kind}
                paymentReceipt={active.paymentReceipt}
                payments={active.payments}
              />

              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
                {active.kind === "SALE" &&
                  active.saleType === "CREDIT" &&
                  active.creditStatus !== "PAID" && (
                    <ButtonLink href="/receivables" variant="outline" size="sm">
                      Manage in receivables
                    </ButtonLink>
                  )}
                {active.kind === "BOOKING" &&
                  active.saleType === "CREDIT" &&
                  active.creditStatus !== "PAID" && (
                    <ButtonLink href="/receivables" variant="outline" size="sm">
                      Manage in receivables
                    </ButtonLink>
                  )}
                {active.kind === "BOOKING" && (
                  <ButtonLink href="/appointments" variant="outline" size="sm">
                    Open appointments
                  </ButtonLink>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
