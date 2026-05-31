"use client";

import { useCallback, useEffect, useState } from "react";
import { PackagePlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import type { StockSummary } from "@/domain/types";
import { DEFAULT_PAGE_SIZE, type PaginationMeta } from "@/lib/pagination";
import { fetchList } from "@/lib/fetch-list";
import { Pagination } from "@/components/ui/pagination";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function InventoryPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [rows, setRows] = useState<StockSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selected, setSelected] = useState<StockSummary | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const loadRows = useCallback(async () => {
    if (!businessId) return;
    const params = new URLSearchParams({
      businessId,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    const { items, meta: listMeta } = await fetchList<StockSummary>(
      `/api/inventory?${params}`
    );
    setRows(items);
    setMeta(listMeta);
  }, [businessId, page]);

  useEffect(() => {
    setPage(1);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    loadRows().finally(() => setLoading(false));
  }, [businessId, loadRows]);

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
        `Stock updated for ${selected.productName} (${qty > 0 ? "+" : ""}${qty})`
      );
      setAdjustOpen(false);
      await loadRows();
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
        <h2 className="text-2xl font-semibold">Inventory</h2>
        <p className="text-muted-foreground">Select or create a business first.</p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Inventory</h2>
          <p className="text-muted-foreground">
            Stock is calculated from the ledger. Use{" "}
            <strong className="font-medium text-foreground">Receive stock</strong>{" "}
            on Purchases to add quantity, or adjust manually below.
          </p>
        </div>
        <ButtonLink href="/purchases" variant="outline">
          <PackagePlus className="size-4" />
          Receive stock
        </ButtonLink>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              rows.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">
                    {r.sku}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.stock}</TableCell>
                  <TableCell className="text-right">{r.minStock}</TableCell>
                  <TableCell>
                    {r.isLowStock ? (
                      <Badge variant="destructive">Low stock</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openAdjust(r)}
                    >
                      <SlidersHorizontal className="size-4" />
                      Adjust
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No products. Add products, then receive stock on Purchases.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 1 && (
        <Pagination meta={meta} onPageChange={setPage} />
      )}

      <Sheet open={adjustOpen} onOpenChange={setAdjustOpen}>
        <SheetContent>
          <form onSubmit={handleAdjust} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Adjust stock</SheetTitle>
              <SheetDescription>
                {selected
                  ? `${selected.productName} — current stock: ${selected.stock}`
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
