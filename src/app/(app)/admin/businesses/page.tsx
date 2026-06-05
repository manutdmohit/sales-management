"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Pencil,
  PauseCircle,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { Business, BusinessType } from "@/domain/types";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  DEFAULT_CURRENCY,
  businessTypeLabel,
} from "@/domain/business-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import {
  ListPageHeader,
} from "@/components/ui/mobile-list-toolbar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FormMode = "create" | "edit" | null;

const emptyForm = {
  name: "",
  slug: "",
  code: "",
  type: "GENERAL" as BusinessType,
  currency: DEFAULT_CURRENCY,
  logoUrl: "",
  address: "",
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
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Business | null>(null);
  const [form, setForm] = useState(emptyForm);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        all: "true",
        page: String(page),
        pageSize: String(pageSize),
      });
      return `/api/businesses?${params}`;
    },
    []
  );

  const {
    items: businesses,
    meta,
    setPage,
    loading,
    reload: loadBusinesses,
  } = usePaginatedList<Business>(buildUrl, []);

  const stats = useMemo(() => {
    const active = businesses.filter((b) => b.isActive).length;
    return {
      total: meta?.total ?? businesses.length,
      active,
      inactive: businesses.length - active,
    };
  }, [businesses, meta]);

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
      logoUrl: business.settings?.logoUrl ?? "",
      address: business.settings?.address ?? "",
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
            settings: {
              currency: form.currency || undefined,
              logoUrl: form.logoUrl.trim() || undefined,
              address: form.address.trim() || undefined,
            },
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
            settings: {
              currency: form.currency || undefined,
              logoUrl: form.logoUrl.trim() || undefined,
              address: form.address.trim() || undefined,
            },
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

  const statCards = [
    {
      label: "Total businesses",
      value: stats.total,
      icon: Building2,
      tint: "bg-chart-1/10 text-chart-1",
    },
    {
      label: "Active",
      value: stats.active,
      icon: CheckCircle2,
      tint: "bg-chart-5/10 text-chart-5",
    },
    {
      label: "Inactive",
      value: stats.inactive,
      icon: PauseCircle,
      tint: "bg-muted-foreground/10 text-muted-foreground",
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-500 sm:space-y-6">
      <ListPageHeader
        title="Businesses"
        descriptionMobile="Manage tenants and business types."
        description="Add and manage tenants. Inactive businesses are hidden from the header selector."
        actions={
          <Button className="col-span-2 sm:col-span-1" onClick={openCreate}>
            <Plus className="size-4" />
            Add business
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {statCards.map(({ label, value, icon: Icon, tint }) => (
          <div
            key={label}
            className="card-elevated card-hover flex items-center justify-between rounded-2xl bg-card p-4"
          >
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground sm:text-sm">
                {label}
              </p>
              <p className="text-xl font-semibold tabular-nums sm:text-2xl">
                {value}
              </p>
            </div>
            <div
              className={`flex size-10 items-center justify-center rounded-xl sm:size-11 ${tint}`}
            >
              <Icon className="size-5" />
            </div>
          </div>
        ))}
      </div>

      <DataTable
        columns={[
          {
            id: "name",
            header: "Name",
            mobilePrimary: true,
            cell: (b) => <span className="font-medium">{b.name}</span>,
          },
          {
            id: "slug",
            header: "Slug",
            hideOnMobile: true,
            cell: (b) => <span className="font-mono text-sm">{b.slug}</span>,
          },
          {
            id: "code",
            header: "Code",
            hideOnMobile: true,
            cell: (b) => <span className="font-mono text-sm">{b.code}</span>,
          },
          {
            id: "type",
            header: "Type",
            cell: (b) => (
              <Badge variant="outline">{businessTypeLabel(b.type)}</Badge>
            ),
          },
          {
            id: "currency",
            header: "Currency",
            hideOnMobile: true,
            cell: (b) => b.settings?.currency ?? "—",
          },
          {
            id: "status",
            header: "Status",
            cell: (b) =>
              b.isActive ? (
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
            cell: (b) => (
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
                  aria-label={
                    b.isActive ? `Deactivate ${b.name}` : `Reactivate ${b.name}`
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          },
        ]}
        data={businesses}
        rowKey={(b) => b._id}
        loading={loading}
        emptyMessage={
          <>
            No businesses yet. Click Add business or run{" "}
            <code className="text-xs">npm run seed</code>.
          </>
        }
        meta={meta}
        onPageChange={setPage}
      />

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
                  className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
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
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  placeholder="/images/logo/magic-touch-logo.jpg"
                  value={form.logoUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, logoUrl: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Path under <code className="text-foreground">public/</code>, e.g.{" "}
                  <code className="text-foreground">/images/logo/your-logo.jpg</code>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Street, area, city"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  placeholder={DEFAULT_CURRENCY}
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
