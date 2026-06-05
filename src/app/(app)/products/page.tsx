"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, FolderOpen, Search } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import type { Product, ProductCategory, ProductKind } from "@/domain/types";
import { businessTypeLabel } from "@/domain/business-types";
import { hasFeature } from "@/domain/capabilities";
import { defaultUnitForKind, getUnitSymbol, type StockUnitId } from "@/domain/units";
import { UnitSelect } from "@/components/products/unit-select";
import { CategoryManagerSheet } from "@/components/products/category-manager";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FormMode = "create" | "edit" | null;

type RecipeLineForm = { rawProductId: string; quantityPerUnit: string };

const emptyForm = {
  name: "",
  slug: "",
  sku: "",
  purchase: "",
  selling: "",
  minStock: "0",
  trackExpiry: false,
  productKind: "FINISHED" as ProductKind,
  unitId: defaultUnitForKind("FINISHED"),
  categoryId: "",
  recipeLines: [] as RecipeLineForm[],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ProductRowActions({
  product,
  onEdit,
  onToggleActive,
  compact = false,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onToggleActive: (p: Product) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 min-h-9 touch-manipulation px-3"
          onClick={() => onEdit(product)}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-h-9 touch-manipulation px-3 text-muted-foreground"
          onClick={() => onToggleActive(product)}
        >
          <Trash2 className="size-3.5" />
          {product.isActive ? "Off" : "On"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onEdit(product)}
        aria-label={`Edit ${product.name}`}
      >
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onToggleActive(product)}
        aria-label={
          product.isActive ? `Deactivate ${product.name}` : `Reactivate ${product.name}`
        }
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export default function ProductsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const isManufacturer = hasFeature(selectedBusiness?.type, "manufacturing");

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c._id, c])),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    if (!businessId) {
      setCategories([]);
      return;
    }
    const res = await fetch(`/api/categories?businessId=${businessId}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setCategories(json.data ?? []);
  }, [businessId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      if (!businessId) return null;
      const params = new URLSearchParams({
        businessId,
        all: "true",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      if (categoryFilter === "uncategorized") {
        params.set("uncategorized", "true");
      } else if (categoryFilter !== "ALL") {
        params.set("categoryId", categoryFilter);
      }
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/products?${params}`;
    },
    [businessId, search, sort, dir, categoryFilter]
  );

  const {
    items: products,
    meta,
    page,
    setPage,
    loading,
    reload: loadProducts,
  } = usePaginatedList<Product>(buildUrl, [businessId, search, sort, dir, categoryFilter]);

  useEffect(() => {
    if (!businessId || !isManufacturer) {
      setRawProducts([]);
      return;
    }
    fetch(`/api/products?businessId=${businessId}&productKind=RAW&all=true`)
      .then((r) => r.json())
      .then((json) => setRawProducts(json.data ?? []));
  }, [businessId, isManufacturer, mode]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        sortKey: "name",
        mobilePrimary: true,
        cell: (p: Product) => (
          <span className="font-medium">{p.name}</span>
        ),
      },
      {
        id: "category",
        header: "Category",
        hideOnMobile: true,
        cell: (p: Product) =>
          p.categoryId ? (
            categoryById.get(p.categoryId)?.name ?? "—"
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "type",
        header: "Business type",
        hideOnMobile: true,
        cell: (p: Product) => (
          <Badge variant="outline">
            {businessTypeLabel(p.businessType)}
          </Badge>
        ),
      },
      ...(isManufacturer
        ? [
            {
              id: "productKind",
              header: "Kind",
              hideOnMobile: true,
              cell: (p: Product) => (
                <Badge variant={p.productKind === "RAW" ? "secondary" : "default"}>
                  {p.productKind === "RAW" ? "Raw" : "Finished"}
                </Badge>
              ),
            },
          ]
        : []),
      {
        id: "sku",
        header: "SKU",
        sortKey: "sku",
        cell: (p: Product) => (
          <span className="font-mono text-sm">{p.sku}</span>
        ),
      },
      {
        id: "unit",
        header: "Unit",
        hideOnMobile: true,
        cell: (p: Product) => (
          <span className="text-muted-foreground">
            {getUnitSymbol(p.unitId) ?? "—"}
          </span>
        ),
      },
      {
        id: "purchase",
        header: "Purchase",
        hideOnMobile: true,
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (p: Product) => p.pricing.purchase.toFixed(2),
      },
      {
        id: "selling",
        header: "Selling",
        sortKey: "pricing.selling",
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (p: Product) => p.pricing.selling.toFixed(2),
      },
      {
        id: "unitCost",
        header: "Unit cost",
        hideOnMobile: true,
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (p: Product) => {
          const cost = p.pricing.unitCost ?? p.pricing.purchase;
          return cost.toFixed(2);
        },
      },
      {
        id: "margin",
        header: "Margin",
        hideOnMobile: true,
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (p: Product) => {
          const cost = p.pricing.unitCost ?? p.pricing.purchase;
          const margin = p.pricing.selling - cost;
          return margin.toFixed(2);
        },
      },
      {
        id: "marginPct",
        header: "Margin %",
        hideOnMobile: true,
        headerClassName: "text-right",
        className: "text-right font-mono",
        cell: (p: Product) => {
          const cost = p.pricing.unitCost ?? p.pricing.purchase;
          if (p.pricing.selling <= 0) return "—";
          const pct = ((p.pricing.selling - cost) / p.pricing.selling) * 100;
          return `${pct.toFixed(1)}%`;
        },
      },
      {
        id: "minStock",
        header: "Min stock",
        sortKey: "minStock",
        hideOnMobile: true,
        cell: (p: Product) => formatQuantityWithUnit(p.minStock, p.unitId),
      },
      {
        id: "expiry",
        header: "Expiry",
        hideOnMobile: true,
        cell: (p: Product) => (p.trackExpiry ? "Yes" : "No"),
      },
      {
        id: "status",
        header: "Status",
        cell: (p: Product) =>
          p.isActive ? (
            <Badge variant="secondary">Active</Badge>
          ) : (
            <Badge variant="outline">Inactive</Badge>
          ),
      },
      {
        id: "actions",
        header: "Actions",
        mobileActions: true,
        headerClassName: "text-right",
        className: "text-right",
        cell: (p: Product) => (
          <ProductRowActions
            product={p}
            onEdit={openEdit}
            onToggleActive={toggleActive}
          />
        ),
      },
    ],
    // openEdit/toggleActive/isManufacturer are stable enough for column defs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isManufacturer, categoryById]
  );

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
      productKind: product.productKind,
      unitId: (product.unitId ?? defaultUnitForKind(product.productKind)) as StockUnitId,
      categoryId: product.categoryId ?? "",
      recipeLines:
        product.recipe?.map((line) => ({
          rawProductId: line.rawProductId,
          quantityPerUnit: String(line.quantityPerUnit),
        })) ?? [],
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
      const recipe =
        isManufacturer &&
        form.productKind === "FINISHED" &&
        form.recipeLines.length > 0
          ? form.recipeLines
              .filter((l) => l.rawProductId && l.quantityPerUnit)
              .map((l) => ({
                rawProductId: l.rawProductId,
                quantityPerUnit: Number(l.quantityPerUnit),
              }))
              .filter((l) => l.quantityPerUnit > 0)
          : undefined;

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
            unitId: form.unitId,
            categoryId: form.categoryId || null,
            isActive: true,
            ...(isManufacturer && { productKind: form.productKind, recipe }),
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
            unitId: form.unitId,
            categoryId: form.categoryId || null,
            ...(isManufacturer && {
              productKind: form.productKind,
              recipe: form.productKind === "FINISHED" ? recipe : [],
            }),
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
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Products
          </h2>
          <p className="text-sm text-muted-foreground sm:hidden">
            Catalog for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
          </p>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Manage catalog for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            {selectedBusiness && (
              <Badge variant="outline" className="ml-2 align-middle">
                {businessTypeLabel(selectedBusiness.type)}
              </Badge>
            )}
            . Products are scoped to this business. Stock comes from purchases,
            production, and sales.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:flex-wrap">
          <Button
            variant="outline"
            className="min-h-10 touch-manipulation"
            onClick={() => setCategoriesOpen(true)}
          >
            <FolderOpen className="size-4" />
            <span className="truncate">Categories</span>
          </Button>
          <Button className="min-h-10 touch-manipulation" onClick={openCreate}>
            <Plus className="size-4" />
            Add product
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/90 p-3 shadow-sm ring-1 ring-foreground/[0.03] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="relative min-w-0 flex-1">
            <Label htmlFor="product-search" className="sr-only">
              Search products
            </Label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="product-search"
              placeholder="Search name or SKU…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-11 pl-9 text-base sm:text-sm"
            />
          </div>
          <div className="min-w-0 space-y-1.5 sm:w-48">
            <Label
              htmlFor="category-filter"
              className="text-xs font-medium text-muted-foreground"
            >
              Category
            </Label>
            <select
              id="category-filter"
              className="flex h-11 w-full cursor-pointer rounded-lg border border-input bg-background px-3 text-base shadow-xs sm:text-sm"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={products}
        rowKey={(p) => p._id}
        loading={loading}
        emptyMessage={
          <>
            No products yet. Click Add product or run{" "}
            <code className="text-xs">npm run seed</code>.
          </>
        }
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent>
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {mode === "create" ? "Add product" : "Edit product"}
              </SheetTitle>
              <SheetDescription>
                {mode === "create"
                  ? `SKU must be unique within ${selectedBusiness?.name ?? "this business"}. Business type: ${selectedBusiness ? businessTypeLabel(selectedBusiness.type) : "—"}.`
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

              {isManufacturer && (
                <div className="space-y-2">
                  <Label htmlFor="productKind">Product kind</Label>
                  <select
                    id="productKind"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                    value={form.productKind}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        productKind: e.target.value as ProductKind,
                        unitId: defaultUnitForKind(e.target.value as ProductKind),
                        recipeLines:
                          e.target.value === "FINISHED" ? f.recipeLines : [],
                      }))
                    }
                  >
                    <option value="RAW">Raw material</option>
                    <option value="FINISHED">Finished good</option>
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="categoryId">Category</Label>
                <select
                  id="categoryId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, categoryId: e.target.value }))
                  }
                >
                  <option value="">No category</option>
                  {categories
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unitId">Stock unit</Label>
                <UnitSelect
                  id="unitId"
                  value={form.unitId}
                  productKind={isManufacturer ? form.productKind : undefined}
                  onChange={(unitId) => setForm((f) => ({ ...f, unitId }))}
                />
                <p className="text-xs text-muted-foreground">
                  Inventory, purchases, and recipes use this unit for this
                  product.
                </p>
              </div>

              {isManufacturer && form.productKind === "FINISHED" && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <Label>Recipe (raw materials per unit)</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          recipeLines: [
                            ...f.recipeLines,
                            { rawProductId: "", quantityPerUnit: "1" },
                          ],
                        }))
                      }
                    >
                      Add ingredient
                    </Button>
                  </div>
                  {form.recipeLines.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Amounts are in each raw material&apos;s stock unit (per 1{" "}
                      {getUnitSymbol(form.unitId) ?? "finished unit"}).
                    </p>
                  )}
                  {form.recipeLines.map((line, index) => {
                    const rawUnit = getUnitSymbol(
                      rawProducts.find((p) => p._id === line.rawProductId)
                        ?.unitId
                    );
                    return (
                    <div key={index} className="grid grid-cols-5 gap-2">
                      <select
                        className="col-span-3 flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={line.rawProductId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            recipeLines: f.recipeLines.map((l, i) =>
                              i === index
                                ? { ...l, rawProductId: e.target.value }
                                : l
                            ),
                          }))
                        }
                      >
                        <option value="">Raw material…</option>
                        {rawProducts.map((p) => (
                          <option key={p._id} value={p._id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        className="col-span-1"
                        type="number"
                        min="0.001"
                        step="any"
                        placeholder={rawUnit ?? "Qty"}
                        title={rawUnit ? `Per finished unit, in ${rawUnit}` : undefined}
                        value={line.quantityPerUnit}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            recipeLines: f.recipeLines.map((l, i) =>
                              i === index
                                ? { ...l, quantityPerUnit: e.target.value }
                                : l
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="col-span-1"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            recipeLines: f.recipeLines.filter(
                              (_, i) => i !== index
                            ),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    );
                  })}
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

      <CategoryManagerSheet
        businessId={businessId}
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        onChanged={() => void loadCategories()}
      />
    </div>
  );
}
