"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Truck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { Purchase, PurchaseItem, SupplierDetail } from "@/domain/types";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { formatDateYmd } from "@/lib/format-datetime";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  MobileCardHeader,
  MobileCardMetrics,
  MobileCardShell,
} from "@/components/ui/mobile-card";
import { ReceiptCell } from "@/components/receipts/payment-receipts";

function money(n: number): string {
  return n.toFixed(2);
}

function purchaseItemLabel(item: PurchaseItem): string {
  return `${item.productName} (+${formatQuantityWithUnit(item.quantity, item.unitId)})`;
}

export default function SupplierProfilePage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;

  const [summary, setSummary] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load supplier");
      setSummary(json.data as SupplierDetail);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load supplier");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const buildPurchasesUrl = useCallback(
    (page: number, pageSize: number) => {
      const p = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      return `/api/suppliers/${supplierId}/purchases?${p}`;
    },
    [supplierId]
  );

  const purchases = usePaginatedList<Purchase>(buildPurchasesUrl, [supplierId]);

  if (loading && !summary) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!summary) {
    return (
      <div className="space-y-4">
        <ButtonLink href="/suppliers" variant="outline" size="sm">
          <ArrowLeft className="size-4" />
          Back to suppliers
        </ButtonLink>
        <p className="text-muted-foreground">Supplier not found.</p>
      </div>
    );
  }

  const s = summary.stats;

  return (
    <div className="space-y-4 sm:space-y-6">
      <ButtonLink href="/suppliers" variant="ghost" size="sm" className="-ml-2">
        <ArrowLeft className="size-4" />
        Back to suppliers
      </ButtonLink>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {summary.name}
            </h2>
            {summary.isActive ? (
              <Badge variant="secondary">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {summary.contactPerson && (
              <span className="flex items-center gap-1.5">
                <UserRound className="size-3.5" />
                {summary.contactPerson}
              </span>
            )}
            {summary.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                {summary.phone}
              </span>
            )}
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
          {summary.notes && (
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
              {summary.notes}
            </p>
          )}
        </div>
        <ButtonLink href="/purchases" variant="outline">
          <Truck className="size-4" />
          Receive stock
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total purchases"
          value={money(s.purchaseTotal)}
          hint={`${s.purchaseCount} order${s.purchaseCount === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Last purchase"
          value={
            s.lastPurchaseAt
              ? formatDateYmd(s.lastPurchaseAt)
              : "—"
          }
        />
        <StatCard label="Contact email" value={summary.email ?? "—"} />
      </div>

      {summary.recentPurchases.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">Recent purchases</h3>
          <div className="space-y-2">
            {summary.recentPurchases.map((p) => (
              <Card key={p._id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <span>{formatDateYmd(p.createdAt)}</span>
                  <span className="text-muted-foreground">
                    {p.items.map((i) => purchaseItemLabel(i)).join(", ")}
                  </span>
                  <span className="font-mono font-medium">{money(p.total)}</span>
                  {p.receipts?.[0] && <ReceiptCell receipt={p.receipts[0]} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-3 text-sm font-semibold">All purchases</h3>
        <DataTable
          columns={[
            {
              id: "date",
              header: "Date",
              hideOnMobile: true,
              cell: (p) => formatDateYmd(p.createdAt),
            },
            {
              id: "items",
              header: "Items",
              mobilePrimary: true,
              cell: (p) => p.items.map((i) => purchaseItemLabel(i)).join(", "),
              className: "max-w-md whitespace-normal",
            },
            {
              id: "ref",
              header: "Reference",
              hideOnMobile: true,
              cell: (p) => p.referenceNumber ?? "—",
            },
            {
              id: "total",
              header: "Total",
              hideOnMobile: true,
              headerClassName: "text-right",
              className: "text-right font-mono",
              cell: (p) => p.total.toFixed(2),
            },
            {
              id: "receipt",
              header: "Receipt",
              hideOnMobile: true,
              cell: (p) => <ReceiptCell receipt={p.receipts?.[0]} />,
            },
          ]}
          data={purchases.items}
          rowKey={(p) => p._id}
          loading={purchases.loading}
          emptyMessage="No purchases from this supplier yet."
          meta={purchases.meta}
          onPageChange={purchases.setPage}
          renderMobileCard={(p) => (
            <MobileCardShell>
              <MobileCardHeader
                title={formatDateYmd(p.createdAt)}
                subtitle={p.referenceNumber ?? "No reference"}
              />
              <MobileCardMetrics
                items={[
                  {
                    label: "Total",
                    value: p.total.toFixed(2),
                    highlight: true,
                  },
                  {
                    label: "Items",
                    value: p.items.length,
                  },
                ]}
              />
            </MobileCardShell>
          )}
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
