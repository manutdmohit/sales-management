"use client";

import { useCallback, useEffect, useState } from "react";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import type { Product } from "@/domain/types";
import { DEFAULT_PAGE_SIZE, type PaginationMeta } from "@/lib/pagination";
import { fetchList } from "@/lib/fetch-list";
import { Pagination } from "@/components/ui/pagination";

type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

export default function PosPage() {
  const { businessId } = useBusiness();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    const params = new URLSearchParams({
      businessId,
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    if (search.trim()) params.set("search", search.trim());
    const [productList, inventoryRes] = await Promise.all([
      fetchList<Product>(`/api/products?${params}`),
      fetch(`/api/inventory?businessId=${businessId}`).then((r) => r.json()),
    ]);
    setProducts(productList.items);
    setMeta(productList.meta);
    const map = new Map<string, number>();
    for (const row of inventoryRes.data ?? []) {
      map.set(row.productId, row.stock);
    }
    setStockMap(map);
  }, [businessId, search, page]);

  useEffect(() => {
    setPage(1);
  }, [businessId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadProducts();
    }, 200);
    return () => clearTimeout(t);
  }, [loadProducts]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product._id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product._id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [
        ...prev,
        {
          productId: product._id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.pricing.selling,
        },
      ];
    });
  }

  const total = cart.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  async function checkout() {
    if (!businessId || cart.length === 0) return;

    const lines = cart
      .map(
        (item) =>
          `• ${item.productName} × ${item.quantity} = ${(item.unitPrice * item.quantity).toFixed(2)}`
      )
      .join("\n");

    const ok = await confirm({
      title: "Complete checkout?",
      description: `${lines}\n\nTotal: ${total.toFixed(2)}\n\nStock will be deducted for these items.`,
      confirmLabel: "Complete sale",
      variant: "warning",
      cancelToast: "Checkout cancelled",
    });
    if (!ok) return;

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          items: cart.map((c) => ({
            productId: c.productId,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
          })),
          paymentMethod: "CASH",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Checkout failed");
      toast.success(`Sale ${json.data.invoiceNumber} — ${json.data.total.toFixed(2)}`);
      setCart([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold">POS</h2>
          <p className="text-muted-foreground">
            Product → Cart → Checkout → Sale → Inventory deduction. Receive
            stock on Purchases first if available qty is 0.
          </p>
        </div>
        <Input
          placeholder="Search products (name or SKU)…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          autoFocus
        />
        <div className="max-h-[420px] space-y-2 overflow-y-auto rounded-md border p-2">
          {products.map((p) => {
            const stock = stockMap.get(p._id) ?? 0;
            return (
            <button
              key={p._id}
              type="button"
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => addToCart(p)}
              disabled={stock <= 0}
            >
              <span>
                {p.name}{" "}
                <span className="text-muted-foreground">({p.sku})</span>
                <span
                  className={
                    stock <= 0
                      ? "ml-2 text-destructive"
                      : "ml-2 text-muted-foreground"
                  }
                >
                  · {stock} in stock
                </span>
              </span>
              <span className="font-mono">{p.pricing.selling.toFixed(2)}</span>
            </button>
            );
          })}
          {products.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No products match your search.
            </p>
          )}
        </div>
        {meta && meta.totalPages > 1 && (
          <Pagination meta={meta} onPageChange={setPage} />
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {cart.map((item) => (
              <li
                key={item.productId}
                className="flex justify-between"
              >
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span className="font-mono">
                  {(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
            {cart.length === 0 && (
              <p className="text-muted-foreground">Cart is empty</p>
            )}
          </ul>
          <div className="flex justify-between border-t pt-4 text-lg font-semibold">
            <span>Total</span>
            <span className="font-mono">{total.toFixed(2)}</span>
          </div>
          <Button
            className="w-full"
            disabled={cart.length === 0 || checkoutLoading}
            onClick={checkout}
          >
            {checkoutLoading ? "Processing…" : "Checkout"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
