"use client";

import { useCallback, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import { hasFeature } from "@/domain/capabilities";
import type { Service } from "@/domain/types";
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
  category: "",
  price: "",
  durationMinutes: "",
};

export default function ServicesPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedBusiness = businesses.find((b) => b._id === businessId);

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
      params.set("sort", sort);
      params.set("dir", dir);
      return `/api/services?${params}`;
    },
    [businessId, search, sort, dir]
  );

  const {
    items: services,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<Service>(buildUrl, [businessId, search, sort, dir]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(service: Service) {
    setMode("edit");
    setEditing(service);
    setForm({
      name: service.name,
      category: service.category ?? "",
      price: String(service.price),
      durationMinutes:
        service.durationMinutes != null ? String(service.durationMinutes) : "",
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

    const price = Number(form.price);
    if (Number.isNaN(price)) {
      toast.error("Enter a valid price");
      return;
    }
    const durationMinutes = form.durationMinutes.trim()
      ? Number(form.durationMinutes)
      : undefined;
    if (durationMinutes != null && Number.isNaN(durationMinutes)) {
      toast.error("Enter a valid duration");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            name: form.name,
            category: form.category.trim() || undefined,
            price,
            durationMinutes,
            isActive: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to create service");
        toast.success(`Created ${json.data.name}`);
      } else if (mode === "edit" && editing) {
        const res = await fetch(`/api/services/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            category: form.category.trim() || undefined,
            price,
            durationMinutes,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to update service");
        toast.success(`Updated ${json.data.name}`);
      }
      closeSheet();
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(service: Service) {
    const next = !service.isActive;
    const label = next ? "reactivate" : "deactivate";
    const ok = await confirm({
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} service?`,
      description: `"${service.name}" will be marked as ${next ? "active" : "inactive"}.`,
      confirmLabel: label.charAt(0).toUpperCase() + label.slice(1),
      variant: next ? "default" : "destructive",
      cancelToast: "Action cancelled",
    });
    if (!ok) return;
    const res = await fetch(`/api/services/${service._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? `Failed to ${label}`);
      return;
    }
    toast.success(next ? "Service reactivated" : "Service deactivated");
    await reload();
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Services</h2>
        <p className="text-muted-foreground">
          Select or create a business first.
        </p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  if (selectedBusiness && !hasFeature(selectedBusiness.type, "services")) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Services</h2>
        <p className="text-muted-foreground">
          The selected business type does not use services. Switch to a
          services business (e.g. Salon &amp; services).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Services"
        descriptionMobile={`Service menu for ${selectedBusiness?.name ?? "this business"}.`}
        description={
          <>
            Manage the service menu for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            . Services are booked from Appointments.
          </>
        }
        actions={
          <Button className="col-span-2 sm:col-span-1" onClick={openCreate}>
            <Plus className="size-4" />
            Add service
          </Button>
        }
      />

      <MobileFilterPanel>
        <MobileSearchField
          id="service-search"
          placeholder="Search name or category…"
          value={search}
          onChange={setSearch}
          onPageReset={() => setPage(1)}
        />
      </MobileFilterPanel>

      <DataTable
        columns={[
          {
            id: "name",
            header: "Name",
            sortKey: "name",
            mobilePrimary: true,
            cell: (s) => <span className="font-medium">{s.name}</span>,
          },
          {
            id: "category",
            header: "Category",
            sortKey: "category",
            hideOnMobile: true,
            cell: (s) => s.category ?? "—",
          },
          {
            id: "duration",
            header: "Duration",
            sortKey: "durationMinutes",
            hideOnMobile: true,
            cell: (s) =>
              s.durationMinutes != null ? `${s.durationMinutes} min` : "—",
          },
          {
            id: "price",
            header: "Price",
            sortKey: "price",
            headerClassName: "text-right",
            className: "text-right font-mono",
            cell: (s) => s.price.toFixed(2),
          },
          {
            id: "status",
            header: "Status",
            cell: (s) =>
              s.isActive ? (
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
            cell: (s) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(s)}
                  aria-label={`Edit ${s.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleActive(s)}
                  aria-label={
                    s.isActive ? `Deactivate ${s.name}` : `Reactivate ${s.name}`
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ),
          },
        ]}
        data={services}
        rowKey={(s) => s._id}
        loading={loading}
        emptyMessage="No services yet. Click Add service to create one."
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
                {mode === "create" ? "Add service" : "Edit service"}
              </SheetTitle>
              <SheetDescription>
                Define the service name, price, and optional category/duration.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  placeholder="e.g. Hair, Skincare"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={0}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        durationMinutes: e.target.value,
                      }))
                    }
                  />
                </div>
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
