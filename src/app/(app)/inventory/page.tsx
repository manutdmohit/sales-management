"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarX, PackagePlus, SlidersHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { hasFeature } from "@/domain/capabilities";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import type { ProductKind, StockSummary } from "@/domain/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import {
  MobileCardFooter,
  MobileCardHeader,
  MobileCardMetrics,
  MobileCardShell,
} from "@/components/ui/mobile-card";
import {
  ListPageHeader,
  MobileFilterPanel,
  MobileSearchField,
} from "@/components/ui/mobile-list-toolbar";
import { formatDateYmd } from "@/lib/format-datetime";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ProductKindFilter = "ALL" | ProductKind;

type ExpiryAlertRow = {
  _id: string;
  productName: string;
  sku: string;
  batchNumber: string;
  remainingQuantity: number;
  unitId?: string;
  expiryDate: string;
  level: "warning" | "critical";
};

const KIND_FILTERS: { id: ProductKindFilter; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "RAW", label: "Raw materials" },
  { id: "FINISHED", label: "Finished goods" },
];

export default function InventoryPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const isManufacturer = hasFeature(selectedBusiness?.type, "manufacturing");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<ProductKindFilter>("ALL");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selected, setSelected] = useState<StockSummary | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertRow[]>([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [writeOffBatchId, setWriteOffBatchId] = useState<string | null>(null);

  const loadExpiryAlerts = useCallback(async () => {
    if (!businessId) {
      setExpiryAlerts([]);
      return;
    }
    setExpiryLoading(true);
    try {
      const res = await fetch(`/api/inventory/expiring?businessId=${businessId}`, {
        cache: "no-store",
      });
      const json = await res.json();
      setExpiryAlerts(json.data ?? []);
    } catch {
      setExpiryAlerts([]);
    } finally {
      setExpiryLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void loadExpiryAlerts();
  }, [loadExpiryAlerts]);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (isManufacturer && kindFilter !== "ALL") {
        params.set("productKind", kindFilter);
      }
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/inventory?${params}`;
    },
    [businessId, search, kindFilter, isManufacturer, sort, dir]
  );

  const {
    items: rows,
    meta,
    setPage,
    loading,
    reload: loadRows,
  } = usePaginatedList<StockSummary>(buildUrl, [
    businessId,
    search,
    kindFilter,
    isManufacturer,
    sort,
    dir,
  ]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  function openAdjust(row: StockSummary) {
    setSelected(row);
    setQuantity("");
    setNotes("");
    setAdjustOpen(true);
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !selected) return;

    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty === 0) {
      toast.error("Enter a non-zero quantity (+ to add, − to remove)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          productId: selected.productId,
          quantity: qty,
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Adjustment failed");
      toast.success(
        `Stock updated for ${selected.productName} (${qty > 0 ? "+" : ""}${formatQuantityWithUnit(Math.abs(qty), selected.unitId)})`
      );
      notifyNotificationsChanged();
      setAdjustOpen(false);
      await loadRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleWriteOff(row: ExpiryAlertRow) {
    if (!businessId) return;

    const qtyLabel = formatQuantityWithUnit(row.remainingQuantity, row.unitId);
    const ok = await confirm({
      title:
        row.level === "critical"
          ? "Write off expired batch?"
          : "Write off expiring batch?",
      description: `${row.productName} · Batch ${row.batchNumber} · ${qtyLabel} will be removed from stock and recorded as expired.`,
      confirmLabel: "Write off",
      cancelLabel: "Keep in stock",
      variant: "warning",
      cancelToast: "Batch kept in stock",
    });
    if (!ok) return;

    setWriteOffBatchId(row._id);
    try {
      const res = await fetch("/api/inventory/write-offs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          batchId: row._id,
          type: "EXPIRED",
          notes:
            row.level === "critical"
              ? `Expired batch ${row.batchNumber}`
              : `Disposed before expiry — batch ${row.batchNumber}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Write-off failed");
      toast.success("Batch written off");
      await Promise.all([loadRows(), loadExpiryAlerts()]);
      notifyNotificationsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Write-off failed");
    } finally {
      setWriteOffBatchId(null);
    }
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Inventory</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Inventory"
        descriptionMobile="Ledger stock — receive on Purchases or adjust below."
        description={
          <>
            Stock is calculated from the ledger. Use{" "}
            <strong className="font-medium text-foreground">Receive stock</strong>{" "}
            on Purchases to add quantity, or adjust manually below.
          </>
        }
        actions={
          <ButtonLink href="/purchases" variant="outline">
            <PackagePlus className="size-4" />
            Receive stock
          </ButtonLink>
        }
      />

      <MobileFilterPanel className="space-y-3">
        <MobileSearchField
          id="inventory-search"
          placeholder="Search name or SKU…"
          value={search}
          onChange={setSearch}
          onPageReset={() => setPage(1)}
        />
        {isManufacturer && (
          <div className="flex flex-wrap gap-2">
            {KIND_FILTERS.map((f) => (
              <Button
                key={f.id}
                type="button"
                variant={kindFilter === f.id ? "default" : "outline"}
                size="sm"
                className="min-h-9 touch-manipulation"
                onClick={() => {
                  setKindFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </div>
        )}
      </MobileFilterPanel>

      {(expiryLoading || expiryAlerts.length > 0) && (
        <Card className="border-chart-3/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-chart-3" />
              Batch expiry alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expiryLoading && (
              <p className="text-sm text-muted-foreground">Checking batches…</p>
            )}
            {!expiryLoading && expiryAlerts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No batches expiring within 30 days.
              </p>
            )}
            {!expiryLoading && expiryAlerts.length > 0 && (
              <ul className="divide-y rounded-lg border border-border/60">
                {expiryAlerts.map((row) => (
                  <li
                    key={row._id}
                    className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{row.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Batch {row.batchNumber} · {row.sku} ·{" "}
                        {formatQuantityWithUnit(row.remainingQuantity, row.unitId)}{" "}
                        on hand
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatDateYmd(row.expiryDate)}
                      </span>
                      <Badge
                        variant={
                          row.level === "critical" ? "destructive" : "outline"
                        }
                        className="gap-1"
                      >
                        {row.level === "critical" ? (
                          <CalendarX className="size-3" />
                        ) : (
                          <AlertTriangle className="size-3" />
                        )}
                        {row.level === "critical" ? "Expired" : "Expiring soon"}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        disabled={writeOffBatchId === row._id}
                        onClick={() => void handleWriteOff(row)}
                      >
                        <Trash2 className="size-3.5" />
                        {writeOffBatchId === row._id ? "Writing off…" : "Write off"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={[
          {
            id: "product",
            header: "Product",
            sortKey: "name",
            mobilePrimary: true,
            cell: (r) => r.productName,
          },
          {
            id: "sku",
            header: "SKU",
            sortKey: "sku",
            hideOnMobile: true,
            cell: (r) => (
              <span className="font-mono text-muted-foreground">{r.sku}</span>
            ),
          },
          ...(isManufacturer
            ? [
                {
                  id: "kind",
                  header: "Kind",
                  hideOnMobile: true,
                  cell: (r: StockSummary) => (
                    <Badge
                      variant={r.productKind === "RAW" ? "secondary" : "default"}
                    >
                      {r.productKind === "RAW" ? "Raw" : "Finished"}
                    </Badge>
                  ),
                },
              ]
            : []),
          {
            id: "stock",
            header: "Stock",
            hideOnMobile: true,
            headerClassName: "text-right",
            className: "text-right font-mono",
            cell: (r) => formatQuantityWithUnit(r.stock, r.unitId),
          },
          {
            id: "min",
            header: "Min",
            sortKey: "minStock",
            hideOnMobile: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (r) => formatQuantityWithUnit(r.minStock, r.unitId),
          },
          {
            id: "status",
            header: "Status",
            hideOnMobile: true,
            cell: (r) =>
              r.isLowStock ? (
                <Badge variant="destructive">Low stock</Badge>
              ) : (
                <Badge variant="secondary">OK</Badge>
              ),
          },
          {
            id: "actions",
            header: "Actions",
            mobileActions: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (r) => (
              <Button variant="ghost" size="sm" onClick={() => openAdjust(r)}>
                <SlidersHorizontal className="size-4" />
                Adjust
              </Button>
            ),
          },
        ]}
        data={rows}
        rowKey={(r) => r.productId}
        loading={loading}
        emptyMessage="No products. Add products, then receive stock on Purchases."
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
        renderMobileCard={(r) => (
          <MobileCardShell>
            <MobileCardHeader
              title={r.productName}
              subtitle={[r.sku, isManufacturer && r.productKind === "RAW" ? "Raw" : isManufacturer ? "Finished" : null]
                .filter(Boolean)
                .join(" · ")}
              badge={
                r.isLowStock ? (
                  <Badge variant="destructive">Low</Badge>
                ) : (
                  <Badge variant="secondary">OK</Badge>
                )
              }
            />
            <MobileCardMetrics
              items={[
                {
                  label: "On hand",
                  value: formatQuantityWithUnit(r.stock, r.unitId),
                  highlight: true,
                },
                {
                  label: "Min stock",
                  value: formatQuantityWithUnit(r.minStock, r.unitId),
                },
              ]}
            />
            <MobileCardFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 touch-manipulation"
                onClick={() => openAdjust(r)}
              >
                <SlidersHorizontal className="size-3.5" />
                Adjust
              </Button>
            </MobileCardFooter>
          </MobileCardShell>
        )}
      />

      <Sheet open={adjustOpen} onOpenChange={setAdjustOpen}>
        <SheetContent>
          <form onSubmit={handleAdjust} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Adjust stock</SheetTitle>
              <SheetDescription>
                {selected
                  ? `${selected.productName} — current stock: ${formatQuantityWithUnit(selected.stock, selected.unitId)}`
                  : "Manual correction"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 px-4">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantity change</Label>
                <Input
                  id="qty"
                  type="number"
                  required
                  placeholder="e.g. 50 or -5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Positive adds stock, negative removes (damage, correction).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Reason for adjustment"
                />
              </div>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdjustOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Apply adjustment"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
