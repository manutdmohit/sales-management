"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  ShoppingBag,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { hasFeature } from "@/domain/capabilities";
import type {
  ClientDetail,
  ClientPurchaseRecord,
  ClientServiceRecord,
} from "@/domain/types";
import { ButtonLink } from "@/components/ui/button";
import { formatDateTimeYmd, formatDateYmd } from "@/lib/format-datetime";
import { ClientEmailButton } from "@/components/clients/client-email-sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { ReceiptCell } from "@/components/receipts/payment-receipts";
import { receiptsFromPayments } from "@/lib/receipt-display";
import { cn } from "@/lib/utils";

type Tab = "overview" | "purchases" | "bookings";

function statusVariant(
  status: string
): "secondary" | "outline" | "destructive" {
  if (status === "COMPLETED") return "secondary";
  if (status === "CANCELLED" || status === "NO_SHOW") return "destructive";
  return "outline";
}

function money(n: number): string {
  return n.toFixed(2);
}

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const { businesses } = useBusiness();

  const [summary, setSummary] = useState<ClientDetail | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [purchaseSearch, setPurchaseSearch] = useState("");

  const business = businesses.find((b) => b._id === summary?.businessId);
  const servicesEnabled = hasFeature(business?.type, "appointments");

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load client");
      setSummary(json.data as ClientDetail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load client");
    } finally {
      setSummaryLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const buildPurchasesUrl = useCallback(
    (page: number, pageSize: number) => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (purchaseSearch.trim()) p.set("search", purchaseSearch.trim());
      return `/api/clients/${clientId}/purchases?${p}`;
    },
    [clientId, purchaseSearch]
  );

  const buildBookingsUrl = useCallback(
    (page: number, pageSize: number) => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      return `/api/clients/${clientId}/bookings?${p}`;
    },
    [clientId]
  );

  const purchases = usePaginatedList<ClientPurchaseRecord>(buildPurchasesUrl, [
    clientId,
    purchaseSearch,
  ]);
  const bookings = usePaginatedList<ClientServiceRecord>(buildBookingsUrl, [
    clientId,
  ]);

  if (summaryLoading && !summary) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <ButtonLink href="/clients" variant="outline" size="sm">
          <ArrowLeft className="size-4" />
          Back to clients
        </ButtonLink>
        <p className="text-muted-foreground">Client not found.</p>
      </div>
    );
  }

  const s = summary.stats;
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "purchases", label: `Purchases (${s.purchaseCount})` },
    ...(servicesEnabled
      ? [{ id: "bookings" as Tab, label: `Bookings (${s.bookingCount})` }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <ButtonLink href="/clients" variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="size-4" />
        Back to clients
      </ButtonLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {summary.name}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" />
              {summary.phone}
            </span>
            {summary.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" />
                {summary.email}
              </span>
            )}
            {summary.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                {summary.address}
              </span>
            )}
          </div>
        </div>
        <ClientEmailButton client={summary} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total purchases" value={money(s.purchaseTotal)} hint={`${s.purchaseCount} sale${s.purchaseCount === 1 ? "" : "s"}`} />
        <StatCard
          label="Outstanding credit"
          value={money(s.outstandingCredit)}
          tone={s.outstandingCredit > 0 ? "danger" : "default"}
        />
        {servicesEnabled && (
          <StatCard
            label="Services spend"
            value={money(s.serviceSpend)}
            hint={`${s.bookingCount} booking${s.bookingCount === 1 ? "" : "s"}`}
          />
        )}
        <StatCard
          label="Last visit"
          value={
            s.lastVisit ? formatDateYmd(s.lastVisit) : "—"
          }
        />
      </div>

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <OverviewList
            icon={<ShoppingBag className="size-4" />}
            title="Recent purchases"
            emptyText="No purchases recorded yet."
            onViewAll={
              summary.recentPurchases.length > 0
                ? () => setTab("purchases")
                : undefined
            }
          >
            {summary.recentPurchases.map((p) => (
              <PurchaseRow key={p.saleId} p={p} />
            ))}
          </OverviewList>

          {servicesEnabled && (
            <OverviewList
              icon={<CalendarClock className="size-4" />}
              title="Recent bookings"
              emptyText="No bookings yet."
              onViewAll={
                summary.recentBookings.length > 0
                  ? () => setTab("bookings")
                  : undefined
              }
            >
              {summary.recentBookings.map((b) => (
                <BookingRow key={b.appointmentId} b={b} />
              ))}
            </OverviewList>
          )}
        </div>
      )}

      {tab === "purchases" && (
        <div className="space-y-4">
          <Input
            placeholder="Search by invoice or product…"
            value={purchaseSearch}
            onChange={(e) => setPurchaseSearch(e.target.value)}
            className="max-w-sm"
          />
          <DataTable
            columns={[
              {
                id: "invoice",
                header: "Invoice",
                cell: (p: ClientPurchaseRecord) => (
                  <span className="font-mono text-sm">{p.invoiceNumber}</span>
                ),
              },
              {
                id: "date",
                header: "Date",
                cell: (p: ClientPurchaseRecord) =>
                  formatDateTimeYmd(p.createdAt),
              },
              {
                id: "items",
                header: "Items",
                className: "max-w-sm whitespace-normal",
                cell: (p: ClientPurchaseRecord) =>
                  p.items
                    .map((i) => `${i.productName} ×${i.quantity}`)
                    .join(", "),
              },
              {
                id: "type",
                header: "Type",
                cell: (p: ClientPurchaseRecord) => (
                  <Badge
                    variant={p.saleType === "CREDIT" ? "outline" : "secondary"}
                  >
                    {p.saleType === "CREDIT" ? "Credit" : "Paid"}
                  </Badge>
                ),
              },
              {
                id: "due",
                header: "Outstanding",
                headerClassName: "text-right",
                className: "text-right font-mono",
                cell: (p: ClientPurchaseRecord) =>
                  p.amountDue > 0 ? (
                    <span className="text-destructive">{money(p.amountDue)}</span>
                  ) : (
                    "—"
                  ),
              },
              {
                id: "total",
                header: "Total",
                headerClassName: "text-right",
                className: "text-right font-mono font-semibold",
                cell: (p: ClientPurchaseRecord) => money(p.total),
              },
              {
                id: "receipt",
                header: "Receipt",
                cell: (p: ClientPurchaseRecord) => (
                  <ReceiptCell receipt={receiptsFromPayments(p.payments)[0]} />
                ),
              },
            ]}
            data={purchases.items}
            rowKey={(p) => p.saleId}
            loading={purchases.loading}
            meta={purchases.meta}
            onPageChange={purchases.setPage}
            emptyMessage="No purchases match."
          />
        </div>
      )}

      {tab === "bookings" && servicesEnabled && (
        <DataTable
          columns={[
            {
              id: "service",
              header: "Service",
              cell: (b: ClientServiceRecord) => b.serviceName,
            },
            {
              id: "when",
              header: "When",
              cell: (b: ClientServiceRecord) =>
                formatDateTimeYmd(b.startAt),
            },
            {
              id: "status",
              header: "Status",
              cell: (b: ClientServiceRecord) => (
                <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
              ),
            },
            {
              id: "price",
              header: "Price",
              headerClassName: "text-right",
              className: "text-right font-mono font-semibold",
              cell: (b: ClientServiceRecord) => money(b.price),
            },
            {
              id: "receipt",
              header: "Receipt",
              cell: (b: ClientServiceRecord) => (
                <ReceiptCell receipt={b.paymentReceipt} />
              ),
            },
          ]}
          data={bookings.items}
          rowKey={(b) => b.appointmentId}
          loading={bookings.loading}
          meta={bookings.meta}
          onPageChange={bookings.setPage}
          emptyMessage="No bookings yet."
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 text-xl font-semibold tabular-nums",
            tone === "danger" && value !== "0.00" && "text-destructive"
          )}
        >
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewList({
  icon,
  title,
  emptyText,
  onViewAll,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  emptyText: string;
  onViewAll?: () => void;
  children: React.ReactNode[];
}) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {onViewAll && (
          <button
            type="button"
            className="cursor-pointer text-xs text-primary hover:underline"
            onClick={onViewAll}
          >
            View all
          </button>
        )}
      </div>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </div>
  );
}

function PurchaseRow({ p }: { p: ClientPurchaseRecord }) {
  const receipt = receiptsFromPayments(p.payments)[0];
  return (
    <li className="rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{p.invoiceNumber}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTimeYmd(p.createdAt)}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {p.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(p.total)}</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            {receipt && <ReceiptCell receipt={receipt} />}
            <Badge
              variant={p.saleType === "CREDIT" ? "outline" : "secondary"}
            >
              {p.saleType === "CREDIT" ? "Credit" : "Paid"}
            </Badge>
          </div>
        </div>
      </div>
    </li>
  );
}

function BookingRow({ b }: { b: ClientServiceRecord }) {
  return (
    <li className="rounded-lg border border-border/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{b.serviceName}</p>
          <p className="text-xs text-muted-foreground">
            {formatDateTimeYmd(b.startAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(b.price)}</p>
          <div className="mt-1 flex items-center justify-end gap-2">
            {b.paymentReceipt && <ReceiptCell receipt={b.paymentReceipt} />}
            <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
          </div>
        </div>
      </div>
    </li>
  );
}
