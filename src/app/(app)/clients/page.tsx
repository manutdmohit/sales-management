"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Eye, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import { hasFeature } from "@/domain/capabilities";
import type { Client } from "@/domain/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClientEmailButton } from "@/components/clients/client-email-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
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
  address: "",
  email: "",
  phone: "",
};

export default function ClientsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<SortDir>("asc");
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const servicesEnabled = hasFeature(selectedBusiness?.type, "appointments");

  const buildUrl = useCallback(
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
      return `/api/clients?${params}`;
    },
    [businessId, search, sort, dir]
  );

  const {
    items: clients,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<Client>(buildUrl, [businessId, search, sort, dir]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setForm({
      name: client.name,
      address: client.address ?? "",
      email: client.email ?? "",
      phone: client.phone,
    });
    setFormOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Name and contact are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim(),
      };
      const res = editing
        ? await fetch(`/api/clients/${editing._id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/clients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, ...payload }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      toast.success(editing ? "Client updated" : "Client added");
      setFormOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
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
        <h2 className="text-2xl font-semibold">Clients</h2>
        <p className="text-muted-foreground">Select a business to continue.</p>
      </div>
    );
  }

  if (!hasFeature(selectedBusiness?.type, "clients")) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Clients</h2>
        <p className="text-muted-foreground">
          Client database is available for service businesses (e.g. Magic Touch).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Clients</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer database — open a client to see their purchases
            {servicesEnabled ? " and bookings" : ""}.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          Add client
        </Button>
      </div>

      <div className="max-w-sm w-full sm:max-w-sm">
        <Input
          placeholder="Search name, phone, email, address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={[
          {
            id: "name",
            header: "Name",
            sortKey: "name",
            cell: (c: Client) => (
              <Link
                href={`/clients/${c._id}`}
                className="cursor-pointer font-medium text-primary hover:underline"
              >
                {c.name}
              </Link>
            ),
          },
          {
            id: "phone",
            header: "Contact",
            sortKey: "phone",
            cell: (c: Client) => c.phone,
          },
          {
            id: "email",
            header: "Email",
            sortKey: "email",
            cell: (c: Client) => c.email ?? "—",
          },
          {
            id: "address",
            header: "Address",
            cell: (c: Client) => c.address ?? "—",
          },
          {
            id: "actions",
            header: "",
            headerClassName: "text-right",
            className: "text-right",
            cell: (c: Client) => (
              <div className="flex justify-end gap-1">
                <ClientEmailButton client={c} variant="ghost" size="icon" className="size-8" />
                <ButtonLink href={`/clients/${c._id}`} variant="outline" size="sm">
                  <Eye className="size-3.5" />
                  View
                </ButtonLink>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Edit ${c.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(c);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
        data={clients}
        rowKey={(c) => c._id}
        loading={loading}
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
        emptyMessage="No clients yet. Add one or book a service to auto-create."
      />

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex flex-col p-0 sm:max-w-md">
          <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border/60">
              <SheetTitle>{editing ? "Edit client" : "Add client"}</SheetTitle>
              <SheetDescription>
                Name, address, email, and contact number.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
              <div className="space-y-2">
                <Label htmlFor="client-name">Name</Label>
                <Input
                  id="client-name"
                  required
                  autoComplete="name"
                  placeholder="Full name"
                  className="h-9"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-address">Address</Label>
                <Input
                  id="client-address"
                  autoComplete="street-address"
                  placeholder="Street, city"
                  className="h-9"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-email">Email (optional)</Label>
                <Input
                  id="client-email"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  placeholder="name@example.com"
                  className="h-9"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Contact</Label>
                <Input
                  id="client-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="Phone number"
                  className="h-9"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add client"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
