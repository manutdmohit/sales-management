"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import type { Business, BusinessType } from "@/domain/types";
import { DEFAULT_PAGE_SIZE, type PaginationMeta } from "@/lib/pagination";
import { fetchList } from "@/lib/fetch-list";
import { Pagination } from "@/components/ui/pagination";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
} from "@/domain/business-types";
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
  code: "",
  type: "GENERAL" as BusinessType,
  currency: "INR",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminBusinessesPage() {
  const { refresh: refreshContext } = useBusiness();
  const { confirm } = useConfirm();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadBusinesses = useCallback(async () => {
    const params = new URLSearchParams({
      all: "true",
      page: String(page),
      pageSize: String(DEFAULT_PAGE_SIZE),
    });
    const { items, meta: listMeta } = await fetchList<Business>(
      `/api/businesses?${params}`
    );
    setBusinesses(items);
    setMeta(listMeta);
  }, [page]);

  useEffect(() => {
    loadBusinesses().finally(() => setLoading(false));
  }, [loadBusinesses]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(business: Business) {
    setMode("edit");
    setEditing(business);
    setForm({
      name: business.name,
      slug: business.slug,
      code: business.code,
      type: business.type,
      currency: business.settings?.currency ?? "",
    });
  }

  function closeSheet() {
    setMode(null);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            slug: form.slug,
            code: form.code,
            type: form.type,
            isActive: true,
            settings: { currency: form.currency || undefined },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to create business");
        toast.success(`Created ${json.data.name}`);
      } else if (mode === "edit" && editing) {
        const res = await fetch(`/api/businesses/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            type: form.type,
            settings: { currency: form.currency || undefined },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update business");
        toast.success(`Updated ${json.data.name}`);
      }
      closeSheet();
      await loadBusinesses();
      await refreshContext();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(business: Business) {
    const next = !business.isActive;
    const label = next ? "reactivate" : "deactivate";
    const ok = await confirm({
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} business?`,
      description: `"${business.name}" will be marked as ${next ? "active" : "inactive"}.`,
      confirmLabel: label.charAt(0).toUpperCase() + label.slice(1),
      variant: next ? "default" : "destructive",
      cancelToast: "Action cancelled",
    });
    if (!ok) return;
    const res = await fetch(`/api/businesses/${business._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? `Failed to ${label}`);
      return;
    }
    toast.success(next ? "Business reactivated" : "Business deactivated");
    await loadBusinesses();
    await refreshContext();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin</p>
          <h2 className="text-2xl font-semibold">Businesses</h2>
          <p className="text-muted-foreground">
            Add and manage tenants. Inactive businesses are hidden from the header
            selector.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add business
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!loading && businesses.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No businesses yet. Click Add business or run{" "}
                  <code className="text-xs">npm run seed</code>.
                </TableCell>
              </TableRow>
            )}
            {businesses.map((b) => (
              <TableRow key={b._id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="font-mono text-sm">{b.slug}</TableCell>
                <TableCell className="font-mono text-sm">{b.code}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {BUSINESS_TYPE_LABELS[b.type]}
                  </Badge>
                </TableCell>
                <TableCell>{b.settings?.currency ?? "—"}</TableCell>
                <TableCell>
                  {b.isActive ? (
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
                      onClick={() => openEdit(b)}
                      aria-label={`Edit ${b.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleActive(b)}
                      aria-label={b.isActive ? `Deactivate ${b.name}` : `Reactivate ${b.name}`}
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

      {meta && meta.totalPages > 1 && (
        <Pagination meta={meta} onPageChange={setPage} />
      )}

      <Sheet open={mode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent>
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>
                {mode === "create" ? "Add business" : "Edit business"}
              </SheetTitle>
              <SheetDescription>
                {mode === "create"
                  ? "Slug and code cannot be changed after creation."
                  : "Slug and code are read-only."}
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
                        mode === "create" && (!f.slug || f.slug === slugify(f.name))
                          ? slugify(name)
                          : f.slug,
                    }));
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Business type</Label>
                <select
                  id="type"
                  required
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as BusinessType,
                    }))
                  }
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BUSINESS_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {mode === "create" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug</Label>
                    <Input
                      id="slug"
                      required
                      pattern="[a-z0-9-]+"
                      value={form.slug}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, slug: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                      id="code"
                      required
                      maxLength={20}
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
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
                    <p className="text-muted-foreground">Code</p>
                    <p className="font-mono">{editing.code}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  placeholder="INR"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value }))
                  }
                />
              </div>
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
