"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import type { Product, Purchase, PurchaseItem, PaymentReceipt, Supplier } from "@/domain/types";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import { ReceiptThumb } from "@/components/receipts/receipt-thumb";
import { hasFeature } from "@/domain/capabilities";
import { getUnitSymbol } from "@/domain/units";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { formatDateYmd } from "@/lib/format-datetime";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import {
  ListPageHeader,
  MobileFilterPanel,
  MobileSearchField,
} from "@/components/ui/mobile-list-toolbar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [purchaseReceipt, setPurchaseReceipt] = useState<PaymentReceipt | null>(
    null
  );

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const isManufacturer = hasFeature(selectedBusiness?.type, "manufacturing");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [dir, setDir] = useState<SortDir>("desc");

  const buildPurchasesUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/purchases?${params}`;
    },
    [businessId, search, sort, dir]
  );

  const {
    items: purchases,
    meta: purchaseMeta,
    setPage: setPurchasePage,
    loading: purchasesLoading,
    reload: loadPurchases,
  } = usePaginatedList<Purchase>(buildPurchasesUrl, [
    businessId,
    search,
    sort,
    dir,
  ]);

  const unitByProductId = useMemo(
    () => new Map(products.map((p) => [p._id, p.unitId])),
    [products]
  );

  function purchaseItemLabel(item: PurchaseItem): string {
    const unitId = item.unitId ?? unitByProductId.get(item.productId);
    return `${item.productName} (+${formatQuantityWithUnit(item.quantity, unitId)})`;
  }

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    const params = new URLSearchParams({ businessId });
    if (isManufacturer) params.set("productKind", "RAW");
    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setProducts(json.data ?? []);
  }, [businessId, isManufacturer]);

  const loadSuppliers = useCallback(async () => {
    if (!businessId) return;
    const res = await fetch(`/api/suppliers?businessId=${businessId}`);
    const json = await res.json();
    setSuppliers(json.data ?? []);
  }, [businessId]);

  useEffect(() => {
    if (!businessId) {
      setProductsLoading(false);
      return;
    }
    setProductsLoading(true);
    Promise.all([loadProducts(), loadSuppliers()]).finally(() =>
      setProductsLoading(false)
    );
  }, [businessId, loadProducts, loadSuppliers]);

  function toDateInput(value?: Date | string): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function openReceive() {
    setEditingId(null);
    setSupplierId(suppliers.find((s) => s.isActive)?._id ?? "");
    setReferenceNumber("");
    setLines([emptyLine()]);
    setPurchaseReceipt(null);
    setOpen(true);
  }

  function openEdit(purchase: Purchase) {
    setEditingId(purchase._id);
    setSupplierId(purchase.supplierId ?? "");
    setReferenceNumber(purchase.referenceNumber ?? "");
    setLines(
      purchase.items.map((item) => ({
        productId: item.productId,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost),
        batchNumber: item.batchNumber ?? "",
        expiryDate: toDateInput(item.expiryDate),
      }))
    );
    setPurchaseReceipt(purchase.receipts?.[0] ?? null);
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

    if (!supplierId) {
      toast.error("Select a supplier");
      return;
    }
    const selectedSupplier = suppliers.find((s) => s._id === supplierId);
    if (!selectedSupplier) {
      toast.error("Select a valid supplier");
      return;
    }

    if (editingId) {
      setSaving(true);
      try {
        const res = await fetch(`/api/purchases/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId,
            referenceNumber: referenceNumber.trim() || undefined,
            receipts: purchaseReceipt ? [purchaseReceipt] : [],
            lineUpdates: lines
              .map((line, index) => {
                const product = products.find((p) => p._id === line.productId);
                const tracksExpiry =
                  product?.trackExpiry ||
                  Boolean(line.batchNumber || line.expiryDate);
                if (!tracksExpiry) return null;
                return {
                  index,
                  batchNumber: line.batchNumber.trim() || undefined,
                  expiryDate: line.expiryDate || null,
                };
              })
              .filter(Boolean),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update purchase");
        toast.success("Purchase updated");
        setOpen(false);
        await loadPurchases();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Request failed");
      } finally {
        setSaving(false);
      }
      return;
    }

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

    if (items.length === 0) {
      toast.error("Add at least one valid product line");
      return;
    }

    const lineSummary = items
      .map((item) => {
        const product = products.find((p) => p._id === item.productId);
        const name = product?.name ?? "Product";
        return `• ${name}: +${formatQuantityWithUnit(item.quantity, product?.unitId)} @ ${item.unitCost.toFixed(2)}`;
      })
      .join("\n");

    const purchaseTotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    const ok = await confirm({
      title: "Receive stock?",
      description: `Supplier: ${selectedSupplier.name}\n\n${lineSummary}\n\nEstimated total: ${purchaseTotal.toFixed(2)}\n\nThis will add inventory for these products.`,
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
          supplierId,
          referenceNumber: referenceNumber.trim() || undefined,
          items,
          ...(purchaseReceipt && { receipts: [purchaseReceipt] }),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to record purchase");
      toast.success(`Stock received — purchase ${json.data._id.slice(-6)}`);
      notifyNotificationsChanged();
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
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Purchases"
        descriptionMobile={`Stock receipts for ${selectedBusiness?.name ?? "this business"}.`}
        description={
          <>
            Receive stock for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            . Each purchase adds inventory (stock in) before POS can sell.
          </>
        }
        actions={
          <>
            <ButtonLink href="/suppliers" variant="outline">
              Suppliers
            </ButtonLink>
            <Button onClick={openReceive} disabled={productsLoading}>
              <Plus className="size-4" />
              Receive stock
            </Button>
          </>
        }
      />

      <MobileFilterPanel>
        <MobileSearchField
          id="purchase-search"
          placeholder="Search supplier or reference…"
          value={search}
          onChange={setSearch}
          onPageReset={() => setPurchasePage(1)}
        />
      </MobileFilterPanel>

      <DataTable
        columns={[
          {
            id: "date",
            header: "Date",
            sortKey: "createdAt",
            cell: (p) => formatDateYmd(p.createdAt),
          },
          {
            id: "supplier",
            header: "Supplier",
            sortKey: "supplierName",
            mobilePrimary: true,
            cell: (p) =>
              p.supplierId ? (
                <Link
                  href={`/suppliers/${p.supplierId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {p.supplierName}
                </Link>
              ) : (
                p.supplierName
              ),
          },
          {
            id: "items",
            header: "Items",
            hideOnMobile: true,
            cell: (p) => p.items.map((i) => purchaseItemLabel(i)).join(", "),
            className: "max-w-md whitespace-normal",
          },
          {
            id: "total",
            header: "Total",
            sortKey: "total",
            headerClassName: "text-right",
            className: "text-right font-mono",
            cell: (p) => p.total.toFixed(2),
          },
          {
            id: "receipt",
            header: "Receipt",
            hideOnMobile: true,
            cell: (p) =>
              p.receipts?.[0] ? (
                <ReceiptThumb receipt={p.receipts[0]} />
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            id: "actions",
            header: "",
            mobileActions: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (p) => (
              <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                Edit
              </Button>
            ),
          },
        ]}
        data={purchases}
        rowKey={(p) => p._id}
        loading={purchasesLoading}
        emptyMessage="No purchases yet. Click Receive stock to add inventory."
        meta={purchaseMeta}
        onPageChange={setPurchasePage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
      />

      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditingId(null);
        }}
      >
        <SheetContent className="sm:max-w-lg">
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {editingId ? "Edit purchase" : "Receive stock"}
              </SheetTitle>
              <SheetDescription>
                {editingId
                  ? "Update supplier reference, receipt, or batch/expiry. Quantities and costs are locked once stock is received."
                  : "Records a supplier purchase and increases on-hand quantity."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="supplier">Supplier</Label>
                {suppliers.filter((s) => s.isActive).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No suppliers yet.{" "}
                    <Link href="/suppliers" className="text-primary hover:underline">
                      Add a supplier
                    </Link>{" "}
                    first.
                  </p>
                ) : (
                  <select
                    id="supplier"
                    required
                    className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">Select supplier…</option>
                    {suppliers
                      .filter((s) => s.isActive)
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                          {s.contactPerson ? ` — ${s.contactPerson}` : ""}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference / invoice #</Label>
                <Input
                  id="reference"
                  placeholder="Optional supplier invoice number"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
              </div>

              {lines.map((line, index) => {
                const product = products.find((p) => p._id === line.productId);
                const isEdit = Boolean(editingId);
                return (
                  <div
                    key={index}
                    className="space-y-3 rounded-md border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Line {index + 1}</p>
                      {!isEdit && lines.length > 1 && (
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
                    {isEdit ? (
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">
                          {product?.name ?? line.productId}
                        </p>
                        <p className="text-muted-foreground">
                          {formatQuantityWithUnit(Number(line.quantity), product?.unitId)} @{" "}
                          {Number(line.unitCost).toFixed(2)}
                        </p>
                      </div>
                    ) : (
                      <>
                    <div className="space-y-2">
                      <Label>Product</Label>
                      <select
                        required
                        className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
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
                        <Label>
                          Quantity
                          {product?.unitId && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({getUnitSymbol(product.unitId)})
                            </span>
                          )}
                        </Label>
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
                      </>
                    )}
                    {(product?.trackExpiry ||
                      (isEdit && (line.batchNumber || line.expiryDate))) && (
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

              {!editingId && (
                <Button type="button" variant="outline" onClick={addLine}>
                  <Plus className="size-4" />
                  Add line
                </Button>
              )}

              {businessId && (
                <ReceiptUpload
                  businessId={businessId}
                  category="purchases"
                  value={purchaseReceipt}
                  onChange={setPurchaseReceipt}
                  label="Supplier payment receipt"
                  hint="Photo of invoice, bank transfer, or QR payment to the supplier (optional)."
                  id="purchase-receipt"
                />
              )}
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  productsLoading ||
                  (!editingId &&
                    (products.length === 0 ||
                      suppliers.filter((s) => s.isActive).length === 0))
                }
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Receive stock"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
