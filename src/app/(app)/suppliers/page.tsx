"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import { hasFeature } from "@/domain/capabilities";
import type { Supplier } from "@/domain/types";
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

const emptyForm = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export default function SuppliersPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
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
      return `/api/suppliers?${params}`;
    },
    [businessId, search, sort, dir]
  );

  const {
    items: suppliers,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<Supplier>(buildUrl, [businessId, search, sort, dir]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson ?? "",
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim()) {
      toast.error("Supplier name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const res = editing
        ? await fetch(`/api/suppliers/${editing._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/suppliers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, ...payload }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(editing ? "Supplier updated" : "Supplier added");
      setFormOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier: Supplier) {
    try {
      const res = await fetch(`/api/suppliers/${supplier._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success(
        supplier.isActive ? "Supplier deactivated" : "Supplier reactivated"
      );
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Suppliers</h2>
        <p className="text-muted-foreground">Select a business to continue.</p>
      </div>
    );
  }

  if (!hasFeature(selectedBusiness?.type, "purchases")) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Suppliers</h2>
        <p className="text-muted-foreground">
          Supplier management is available when purchases are enabled.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Suppliers"
        descriptionMobile="Vendor directory and purchase history."
        description="Vendor directory — contact details and purchase history per supplier."
        actions={
          <Button type="button" className="col-span-2 sm:col-span-1" onClick={openCreate}>
            <Plus className="size-4" />
            Add supplier
          </Button>
        }
      />

      <MobileFilterPanel>
        <MobileSearchField
          id="supplier-search"
          placeholder="Search name, phone, or email…"
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
            cell: (s: Supplier) => (
              <Link
                href={`/suppliers/${s._id}`}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                {s.name}
              </Link>
            ),
          },
          {
            id: "contact",
            header: "Contact person",
            sortKey: "contactPerson",
            hideOnMobile: true,
            cell: (s: Supplier) => s.contactPerson ?? "—",
          },
          {
            id: "phone",
            header: "Phone",
            sortKey: "phone",
            cell: (s: Supplier) => s.phone ?? "—",
          },
          {
            id: "email",
            header: "Email",
            sortKey: "email",
            hideOnMobile: true,
            cell: (s: Supplier) => s.email ?? "—",
          },
          {
            id: "status",
            header: "Status",
            cell: (s: Supplier) =>
              s.isActive ? (
                <Badge variant="secondary">Active</Badge>
              ) : (
                <Badge variant="outline">Inactive</Badge>
              ),
          },
          {
            id: "actions",
            header: "",
            mobileActions: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (s: Supplier) => (
              <div className="flex justify-end gap-1">
                <ButtonLink href={`/suppliers/${s._id}`} variant="outline" size="sm">
                  <Eye className="size-3.5" />
                  View
                </ButtonLink>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => openEdit(s)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={
                    s.isActive ? `Deactivate ${s.name}` : `Reactivate ${s.name}`
                  }
                  onClick={() => toggleActive(s)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
        data={suppliers}
        rowKey={(s) => s._id}
        loading={loading}
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
        emptyMessage="No suppliers yet. Add one before receiving stock."
      />

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="font-sans sm:max-w-md">
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit supplier" : "Add supplier"}</SheetTitle>
              <SheetDescription>
                Name, contact details, and notes for this vendor.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-name">Name</Label>
                <Input
                  id="supplier-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-contact">Contact person</Label>
                <Input
                  id="supplier-contact"
                  value={form.contactPerson}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactPerson: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Phone</Label>
                <Input
                  id="supplier-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input
                  id="supplier-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-address">Address</Label>
                <Input
                  id="supplier-address"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-notes">Notes</Label>
                <textarea
                  id="supplier-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs"
                />
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add supplier"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
