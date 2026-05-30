"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { Product } from "@/domain/types";
import { BUSINESS_TYPE_LABELS } from "@/domain/business-types";
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

type FormMode = "create" | "edit" | null;

const emptyForm = {
  name: "",
  slug: "",
  sku: "",
  purchase: "",
  selling: "",
  minStock: "0",
  trackExpiry: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ProductsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedBusiness = businesses.find((b) => b._id === businessId);

  const loadProducts = useCallback(async () => {
    if (!businessId) return;
    const params = new URLSearchParams({ businessId, all: "true" });
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setProducts(json.data ?? []);
  }, [businessId, search]);

  useEffect(() => {
    if (!businessId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProducts().finally(() => setLoading(false));
  }, [businessId, loadProducts]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(product: Product) {
    setMode("edit");
    setEditing(product);
    setForm({
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      purchase: String(product.pricing.purchase),
      selling: String(product.pricing.selling),
      minStock: String(product.minStock),
      trackExpiry: product.trackExpiry,
    });
  }

  function closeSheet() {
    setMode(null);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    const purchase = Number(form.purchase);
    const selling = Number(form.selling);
    const minStock = Number(form.minStock);

    if (Number.isNaN(purchase) || Number.isNaN(selling) || Number.isNaN(minStock)) {
      toast.error("Enter valid numbers for pricing and min stock");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            name: form.name,
            slug: form.slug,
            sku: form.sku,
            pricing: { purchase, selling },
            trackExpiry: form.trackExpiry,
            minStock,
            isActive: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to create product");
        toast.success(`Created ${json.data.name}`);
      } else if (mode === "edit" && editing) {
        const res = await fetch(`/api/products/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            pricing: { purchase, selling },
            trackExpiry: form.trackExpiry,
            minStock,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update product");
        toast.success(`Updated ${json.data.name}`);
      }
      closeSheet();
      await loadProducts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: Product) {
    const next = !product.isActive;
    const label = next ? "reactivate" : "deactivate";
    const ok = await confirm({
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} product?`,
      description: `"${product.name}" will be marked as ${next ? "active" : "inactive"}.`,
      confirmLabel: label.charAt(0).toUpperCase() + label.slice(1),
      variant: next ? "default" : "destructive",
      cancelToast: "Action cancelled",
    });
    if (!ok) return;
    const res = await fetch(`/api/products/${product._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? `Failed to ${label}`);
      return;
    }
    toast.success(next ? "Product reactivated" : "Product deactivated");
    await loadProducts();
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Products</h2>
        <p className="text-muted-foreground">
          Select or create a business first.
        </p>
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
          <h2 className="text-2xl font-semibold">Products</h2>
          <p className="text-muted-foreground">
            Manage catalog for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            {selectedBusiness && (
              <Badge variant="outline" className="ml-2 align-middle">
                {BUSINESS_TYPE_LABELS[selectedBusiness.type]}
              </Badge>
            )}
            . Products are scoped to this business and type. Stock comes from
            purchases and sales.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add product
        </Button>
      </div>

      <div className="flex max-w-sm gap-2">
        <Input
          placeholder="Search name or SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={() => loadProducts()}>
          Search
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Business type</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Purchase</TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <TableHead>Min stock</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground"
                >
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && products.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground"
                >
                  No products yet. Click Add product or run{" "}
                  <code className="text-xs">npm run seed</code>.
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p._id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {BUSINESS_TYPE_LABELS[p.businessType]}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                <TableCell className="text-right">
                  {p.pricing.purchase.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  {p.pricing.selling.toFixed(2)}
                </TableCell>
                <TableCell>{p.minStock}</TableCell>
                <TableCell>{p.trackExpiry ? "Yes" : "No"}</TableCell>
                <TableCell>
                  {p.isActive ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(p)}
                      aria-label={`Edit ${p.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleActive(p)}
                      aria-label={
                        p.isActive ? `Deactivate ${p.name}` : `Reactivate ${p.name}`
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={mode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent>
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {mode === "create" ? "Add product" : "Edit product"}
              </SheetTitle>
              <SheetDescription>
                {mode === "create"
                  ? `SKU must be unique within ${selectedBusiness?.name ?? "this business"}. Business type: ${selectedBusiness ? BUSINESS_TYPE_LABELS[selectedBusiness.type] : "—"}.`
                  : "SKU and slug cannot be changed after creation."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug:
                        mode === "create" &&
                        (!f.slug || f.slug === slugify(f.name))
                          ? slugify(name)
                          : f.slug,
                    }));
                  }}
                />
              </div>

              {mode === "create" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      required
                      value={form.slug}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, slug: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      required
                      value={form.sku}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          sku: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {mode === "edit" && editing && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Slug</p>
                    <p className="font-mono">{editing.slug}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">SKU</p>
                    <p className="font-mono">{editing.sku}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="purchase">Purchase price</Label>
                  <Input
                    id="purchase"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.purchase}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, purchase: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="selling">Selling price</Label>
                  <Input
                    id="selling"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.selling}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, selling: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minStock">Min stock alert</Label>
                <Input
                  id="minStock"
                  type="number"
                  min={0}
                  required
                  value={form.minStock}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minStock: e.target.value }))
                  }
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.trackExpiry}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, trackExpiry: e.target.checked }))
                  }
                  className="size-4 rounded border"
                />
                Track batch expiry
              </label>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "create" ? "Create" : "Save"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
