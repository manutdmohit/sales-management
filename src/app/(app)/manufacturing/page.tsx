"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { hasFeature } from "@/domain/capabilities";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import type { Product, ProductionRun } from "@/domain/types";
import { getUnitSymbol } from "@/domain/units";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { formatDateTimeYmd } from "@/lib/format-datetime";
import { unitMaterialCost as calcUnitMaterialCost } from "@/lib/production-cost";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  ListPageHeader,
  MobileFilterPanel,
  MobileSearchField,
} from "@/components/ui/mobile-list-toolbar";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function defaultProductionBatchNumber(product: Product): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PR-${product.sku}-${ymd}`;
}

function defaultProductionExpiryInput(): string {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export default function ManufacturingPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finishedProducts, setFinishedProducts] = useState<Product[]>([]);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [finishedProductId, setFinishedProductId] = useState("");
  const [quantityProduced, setQuantityProduced] = useState("1");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const canManufacture = hasFeature(selectedBusiness?.type, "manufacturing");

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId || !canManufacture) return null;
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/manufacturing?${params}`;
    },
    [businessId, canManufacture, search, sort, dir]
  );

  const {
    items: runs,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<ProductionRun>(buildUrl, [
    businessId,
    canManufacture,
    search,
    sort,
    dir,
  ]);

  const loadCatalog = useCallback(async () => {
    if (!businessId) return;
    const [productsRes, rawRes, inventoryRes] = await Promise.all([
      fetch(
        `/api/products?businessId=${businessId}&productKind=FINISHED&all=true`
      ),
      fetch(`/api/products?businessId=${businessId}&productKind=RAW&all=true`),
      fetch(`/api/inventory?businessId=${businessId}`),
    ]);
    const productsJson = await productsRes.json();
    const rawJson = await rawRes.json();
    const inventoryJson = await inventoryRes.json();
    const withRecipe = (productsJson.data ?? []).filter(
      (p: Product) => p.recipe && p.recipe.length > 0
    );
    setFinishedProducts(withRecipe);
    setRawProducts(rawJson.data ?? []);
    const map = new Map<string, number>();
    for (const row of inventoryJson.data ?? []) {
      map.set(row.productId, row.stock);
    }
    setStockMap(map);
  }, [businessId]);

  useEffect(() => {
    if (businessId && canManufacture) void loadCatalog();
  }, [businessId, canManufacture, loadCatalog]);

  const selectedFinished = finishedProducts.find(
    (p) => p._id === finishedProductId
  );
  const qty = Number(quantityProduced);

  useEffect(() => {
    if (!selectedFinished?.trackExpiry) {
      setBatchNumber("");
      setExpiryDate("");
      return;
    }
    setBatchNumber(defaultProductionBatchNumber(selectedFinished));
    setExpiryDate(defaultProductionExpiryInput());
  }, [selectedFinished?._id, selectedFinished?.trackExpiry, selectedFinished?.sku]);

  const requirementRows = useMemo(() => {
    if (!selectedFinished?.recipe?.length || !Number.isFinite(qty) || qty <= 0) {
      return [];
    }
    return selectedFinished.recipe.map((line) => {
      const required = line.quantityPerUnit * qty;
      const available = stockMap.get(line.rawProductId) ?? 0;
      const raw = rawProducts.find((p) => p._id === line.rawProductId);
      const rawUnitId = line.rawUnitId ?? raw?.unitId;
      const unitCost = raw?.pricing.purchase ?? 0;
      const lineCost = Math.round(required * unitCost * 100) / 100;
      return {
        ...line,
        rawUnitId,
        required,
        available,
        unitCost,
        lineCost,
        ok: available >= required,
      };
    });
  }, [selectedFinished, qty, stockMap, rawProducts]);

  const estimatedMaterialCost = useMemo(
    () =>
      Math.round(
        requirementRows.reduce((sum, row) => sum + row.lineCost, 0) * 100
      ) / 100,
    [requirementRows]
  );

  const estimatedUnitCost = useMemo(
    () => calcUnitMaterialCost(estimatedMaterialCost, qty),
    [estimatedMaterialCost, qty]
  );

  const allRequirementsMet =
    requirementRows.length > 0 && requirementRows.every((r) => r.ok);

  function openRun() {
    const first = finishedProducts[0];
    setFinishedProductId(first?._id ?? "");
    setQuantityProduced("1");
    setNotes("");
    if (first?.trackExpiry) {
      setBatchNumber(defaultProductionBatchNumber(first));
      setExpiryDate(defaultProductionExpiryInput());
    } else {
      setBatchNumber("");
      setExpiryDate("");
    }
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !finishedProductId) return;
    const quantity = Number(quantityProduced);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity to produce");
      return;
    }
    if (selectedFinished?.trackExpiry) {
      if (!batchNumber.trim()) {
        toast.error("Batch number is required for this product");
        return;
      }
      if (!expiryDate) {
        toast.error("Expiry date is required for this product");
        return;
      }
    }
    if (!allRequirementsMet) {
      toast.error("Insufficient raw material stock");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/manufacturing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          finishedProductId,
          quantityProduced: quantity,
          ...(selectedFinished?.trackExpiry && {
            batchNumber: batchNumber.trim(),
            expiryDate,
          }),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.error
            : "Failed to record production"
        );
      }
      toast.success(
        `Produced ${quantity} × ${json.data.finishedProductName}${
          json.data.totalMaterialCost != null
            ? ` — material cost ${Number(json.data.totalMaterialCost).toFixed(2)}`
            : ""
        }`
      );
      notifyNotificationsChanged();
      setOpen(false);
      await Promise.all([reload(), loadCatalog()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  const columns = useMemo(
    () => [
      {
        id: "createdAt",
        header: "Date",
        sortKey: "createdAt",
        hideOnMobile: true,
        cell: (r: ProductionRun) => formatDateTimeYmd(r.createdAt),
      },
      {
        id: "product",
        header: "Finished product",
        sortKey: "finishedProductName",
        mobilePrimary: true,
        cell: (r: ProductionRun) => (
          <span className="font-medium">{r.finishedProductName}</span>
        ),
      },
      {
        id: "qty",
        header: "Qty produced",
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (r: ProductionRun) =>
          formatQuantityWithUnit(r.quantityProduced, r.finishedUnitId),
      },
      {
        id: "cost",
        header: "Material cost",
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (r: ProductionRun) =>
          r.totalMaterialCost != null ? r.totalMaterialCost.toFixed(2) : "—",
      },
      {
        id: "unitCost",
        header: "Cost / unit",
        hideOnMobile: true,
        headerClassName: "text-right",
        className: "text-right font-mono text-muted-foreground",
        cell: (r: ProductionRun) =>
          r.unitMaterialCost != null ? r.unitMaterialCost.toFixed(2) : "—",
      },
      {
        id: "recipe",
        header: "Raw materials used",
        hideOnMobile: true,
        cell: (r: ProductionRun) => {
          const lines =
            r.materialsSnapshot && r.materialsSnapshot.length > 0
              ? r.materialsSnapshot.map((line) => ({
                  key: line.rawProductId,
                  name: line.rawProductName ?? "Material",
                  qty: line.quantityConsumed,
                  unitId: line.rawUnitId,
                  cost: line.lineCost,
                }))
              : r.recipeSnapshot.map((line) => ({
                  key: line.rawProductId,
                  name: line.rawProductName ?? "Material",
                  qty: line.quantityPerUnit * r.quantityProduced,
                  unitId: line.rawUnitId,
                  cost: undefined as number | undefined,
                }));
          return (
            <ul className="text-xs text-muted-foreground">
              {lines.map((line) => (
                <li key={line.key}>
                  {line.name} × {formatQuantityWithUnit(line.qty, line.unitId)}
                  {line.cost != null && (
                    <span className="ml-1 font-mono">({line.cost.toFixed(2)})</span>
                  )}
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        id: "notes",
        header: "Notes",
        hideOnMobile: true,
        cell: (r: ProductionRun) => r.notes ?? "—",
      },
    ],
    []
  );

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Manufacturing</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  if (!canManufacture) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Manufacturing</h2>
        <p className="text-muted-foreground">
          Manufacturing is only available for manufacturing businesses (e.g.
          Vedic). Switch business in the header or update the business type in
          Admin → Businesses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Manufacturing"
        descriptionMobile={`Production runs for ${selectedBusiness?.name ?? "this business"}.`}
        description={
          <>
            Record production runs for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            . Raw materials are deducted and finished goods are added to stock.
          </>
        }
        actions={
          <Button
            className="col-span-2 sm:col-span-1"
            onClick={openRun}
            disabled={finishedProducts.length === 0}
          >
            <Plus className="size-4" />
            New run
          </Button>
        }
      />

      {finishedProducts.length === 0 && (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Add <strong>finished products</strong> with a recipe on the Products
          page, and ensure raw materials are in stock via Purchases.
        </p>
      )}

      <MobileFilterPanel>
        <MobileSearchField
          id="manufacturing-search"
          placeholder="Search production runs…"
          value={search}
          onChange={setSearch}
          onPageReset={() => setPage(1)}
        />
      </MobileFilterPanel>

      <DataTable<ProductionRun>
        columns={columns}
        data={runs}
        rowKey={(r) => r._id}
        loading={loading}
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={(key, nextDir) => {
          setSort(key);
          setDir(nextDir);
        }}
        emptyMessage="No production runs yet."
      />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-xl">
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b border-border/60 pr-12">
              <SheetTitle>New production run</SheetTitle>
              <SheetDescription>
                Raw materials are deducted from inventory and finished goods are
                added to stock.
              </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
              {selectedFinished && qty > 0 && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">
                    Output preview
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Adds{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {qty}
                    </span>{" "}
                    ×{" "}
                    <span className="font-medium text-foreground">
                      {selectedFinished.name}
                    </span>{" "}
                    to finished goods stock.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="finishedProduct">Finished product</Label>
                  <select
                    id="finishedProduct"
                    className="flex h-10 w-full cursor-pointer rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                    value={finishedProductId}
                    onChange={(e) => setFinishedProductId(e.target.value)}
                    required
                  >
                    <option value="">Select product…</option>
                    {finishedProducts.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantityProduced">
                    Quantity to produce
                    {selectedFinished?.unitId && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({getUnitSymbol(selectedFinished.unitId)})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="quantityProduced"
                    type="number"
                    min="0.01"
                    step="any"
                    className="h-10 font-mono tabular-nums"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Current finished stock</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 font-mono text-sm tabular-nums">
                    {selectedFinished
                      ? formatQuantityWithUnit(
                          stockMap.get(selectedFinished._id) ?? 0,
                          selectedFinished.unitId
                        )
                      : "—"}
                  </div>
                </div>
              </div>

              {requirementRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Raw materials required</p>
                    {allRequirementsMet ? (
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Ready
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <AlertCircle className="size-3.5" />
                        Insufficient stock
                      </Badge>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2.5 font-medium">Material</th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Need
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Have
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Cost
                          </th>
                          <th className="px-3 py-2.5 text-right font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {requirementRows.map((row) => (
                          <tr
                            key={row.rawProductId}
                            className={cn(
                              "border-b last:border-0",
                              !row.ok && "bg-destructive/5"
                            )}
                          >
                            <td className="px-3 py-2.5 font-medium">
                              {row.rawProductName ?? row.rawProductId}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                              {formatQuantityWithUnit(row.required, row.rawUnitId)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums text-muted-foreground">
                              {formatQuantityWithUnit(row.available, row.rawUnitId)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                              {row.lineCost.toFixed(2)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {row.ok ? (
                                <span className="inline-flex items-center gap-1 text-xs text-chart-2">
                                  <CheckCircle2 className="size-3.5" />
                                  OK
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-destructive">
                                  <AlertCircle className="size-3.5" />
                                  Short
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {requirementRows.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">
                        Estimated material cost
                      </span>
                      <div className="text-right">
                        <p className="font-mono text-base font-semibold tabular-nums">
                          {estimatedMaterialCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {estimatedUnitCost.toFixed(2)} per finished unit
                          {selectedFinished?.unitId
                            ? ` (${getUnitSymbol(selectedFinished.unitId)})`
                            : ""}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedFinished?.trackExpiry && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="batchNumber">Output batch #</Label>
                    <Input
                      id="batchNumber"
                      value={batchNumber}
                      onChange={(e) => setBatchNumber(e.target.value)}
                      placeholder="e.g. PR-CKE-20260602"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryDate">Best before</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required
                    />
                  </div>
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    Finished goods are added to inventory as a tracked batch for
                    expiry alerts and write-offs.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Batch note, shift, etc."
                  className="flex min-h-[5rem] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </div>

            <SheetFooter className="mt-0 flex-row justify-end gap-2 border-t border-border/60 bg-background px-4 py-4">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={saving || !allRequirementsMet}
              >
                {saving ? "Recording…" : "Record production"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
