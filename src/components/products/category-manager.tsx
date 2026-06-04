"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ProductCategory } from "@/domain/types";
import { Button } from "@/components/ui/button";
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

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const emptyForm = {
  name: "",
  slug: "",
  description: "",
  sortOrder: "0",
};

type Props = {
  businessId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

export function CategoryManagerSheet({
  businessId,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadCategories = useCallback(async () => {
    if (!businessId) {
      setCategories([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/categories?businessId=${businessId}&all=true`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setCategories(json.data ?? []);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    if (open) void loadCategories();
  }, [open, loadCategories]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(category: ProductCategory) {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      sortOrder: String(category.sortOrder),
    });
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;

    const sortOrder = Number(form.sortOrder);
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      toast.error("Enter a valid sort order");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/categories/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            slug: form.slug.trim() || slugify(form.name),
            description: form.description.trim() || undefined,
            sortOrder,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update category");
        toast.success("Category updated");
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            name: form.name.trim(),
            slug: form.slug.trim() || slugify(form.name),
            description: form.description.trim() || undefined,
            sortOrder,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to create category");
        toast.success("Category created");
      }
      resetForm();
      await loadCategories();
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category: ProductCategory) {
    const res = await fetch(`/api/categories/${category._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !category.isActive }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to update category");
      return;
    }
    toast.success(category.isActive ? "Category deactivated" : "Category activated");
    await loadCategories();
    onChanged?.();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Product categories</SheetTitle>
          <SheetDescription>
            Group finished goods and retail products. Assign categories when
            editing a product.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">
              {editing ? "Edit category" : "New category"}
            </p>
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: editing ? f.slug : slugify(e.target.value),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                required
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description (optional)</Label>
              <Input
                id="cat-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-sort">Sort order</Label>
              <Input
                id="cat-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              {editing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel edit
                </Button>
              )}
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
              </Button>
            </div>
          </form>

          {loading && (
            <p className="text-sm text-muted-foreground">Loading categories…</p>
          )}
          {!loading && categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          )}
          <ul className="divide-y rounded-lg border">
            {categories.map((category) => (
              <li
                key={category._id}
                className="flex items-start justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{category.name}</p>
                  {category.description && (
                    <p className="text-xs text-muted-foreground">
                      {category.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!category.isActive && (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => openEdit(category)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void toggleActive(category)}
                  >
                    {category.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <SheetFooter className="border-t">
          <Button type="button" variant="outline" onClick={() => openCreate()}>
            <Plus className="size-4" />
            New category
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
