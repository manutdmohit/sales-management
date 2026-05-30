"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { Product, Purchase } from "@/domain/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type LineItem = {
  productId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
};

const emptyLine = (): LineItem => ({
  productId: "",
  quantity: "1",
  unitCost: "",
  batchNumber: "",
  expiryDate: "",
});

type PurchaseLineInput = {
  productId: string;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
};

export default function PurchasesPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [supplierName, setSupplierName] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  const selectedBusiness = businesses.find((b) => b._id === businessId);

  const loadPurchases = useCallback(async () => {
    if (!businessId) return;
    const res = await fetch(`/api/purchases?businessId=${businessId}`);
    const json = await res.json();
    setPurchases(json.data ?? []);
  }, [businessId]);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    const res = await fetch(`/api/products?businessId=${businessId}`);
    const json = await res.json();
    setProducts(json.data ?? []);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([loadPurchases(), loadProducts()]).finally(() => setLoading(false));
  }, [businessId, loadPurchases, loadProducts]);

  function openReceive() {
    setSupplierName("");
    setLines([emptyLine()]);
    setOpen(true);
  }

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  }

  function onProductChange(index: number, productId: string) {
    const product = products.find((p) => p._id === productId);
    updateLine(index, {
      productId,
      unitCost: product ? String(product.pricing.purchase) : "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    const items = lines
      .map((line): PurchaseLineInput | null => {
        const quantity = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        if (!line.productId || Number.isNaN(quantity) || quantity <= 0) {
          return null;
        }
        if (Number.isNaN(unitCost) || unitCost < 0) return null;
        const product = products.find((p) => p._id === line.productId);
        return {
          productId: line.productId,
          quantity,
          unitCost,
          ...(product?.trackExpiry && line.batchNumber
            ? { batchNumber: line.batchNumber }
            : {}),
          ...(product?.trackExpiry && line.expiryDate
            ? { expiryDate: line.expiryDate }
            : {}),
        };
      })
      .filter((item): item is PurchaseLineInput => item !== null);

    if (!supplierName.trim()) {
      toast.error("Supplier name is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one valid product line");
      return;
    }

    const lineSummary = items
      .map((item) => {
        const product = products.find((p) => p._id === item.productId);
        const name = product?.name ?? "Product";
        return `• ${name}: +${item.quantity} @ ${item.unitCost.toFixed(2)}`;
      })
      .join("\n");

    const purchaseTotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    const ok = await confirm({
      title: "Receive stock?",
      description: `Supplier: ${supplierName.trim()}\n\n${lineSummary}\n\nEstimated total: ${purchaseTotal.toFixed(2)}\n\nThis will add inventory for these products.`,
      confirmLabel: "Receive stock",
      variant: "warning",
      cancelToast: "Stock receive cancelled",
    });
    if (!ok) return;

    setSaving(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          supplierName: supplierName.trim(),
          items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to record purchase");
      toast.success(`Stock received — purchase ${json.data._id.slice(-6)}`);
      setOpen(false);
      await loadPurchases();
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
        <h2 className="text-2xl font-semibold">Purchases</h2>
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
          <h2 className="text-2xl font-semibold">Purchases</h2>
          <p className="text-muted-foreground">
            Receive stock for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            . Each purchase adds inventory (stock in) before POS can sell.
          </p>
        </div>
        <Button onClick={openReceive}>
          <Plus className="size-4" />
          Receive stock
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              purchases.map((p) => (
                <TableRow key={p._id}>
                  <TableCell>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{p.supplierName}</TableCell>
                  <TableCell>
                    {p.items
                      .map((i) => `${i.productName} (+${i.quantity})`)
                      .join(", ")}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {p.total.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            {!loading && purchases.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No purchases yet. Click Receive stock to add inventory.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Receive stock</SheetTitle>
              <SheetDescription>
                Records a supplier purchase and increases on-hand quantity.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  required
                  placeholder="Supplier name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              </div>

              {lines.map((line, index) => {
                const product = products.find((p) => p._id === line.productId);
                return (
                  <div
                    key={index}
                    className="space-y-3 rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Line {index + 1}</p>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <select
                        required
                        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                        value={line.productId}
                        onChange={(e) => onProductChange(index, e.target.value)}
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name} ({p.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          required
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, { quantity: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Unit cost</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          required
                          value={line.unitCost}
                          onChange={(e) =>
                            updateLine(index, { unitCost: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    {product?.trackExpiry && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Batch #</Label>
                          <Input
                            value={line.batchNumber}
                            onChange={(e) =>
                              updateLine(index, { batchNumber: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiry date</Label>
                          <Input
                            type="date"
                            value={line.expiryDate}
                            onChange={(e) =>
                              updateLine(index, { expiryDate: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <Button type="button" variant="outline" onClick={addLine}>
                <Plus className="size-4" />
                Add line
              </Button>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || products.length === 0}>
                {saving ? "Saving…" : "Receive stock"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
