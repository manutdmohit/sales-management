"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  PauseCircle,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import { useAuth } from "@/lib/auth-context";
import { usePaginatedList } from "@/lib/use-paginated-list";
import { USER_ROLES, type UserRole } from "@/domain/roles";
import type { TeamMember } from "@/services/team.service";
import { Button } from "@/components/ui/button";
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

type FormMode = "create" | "edit" | "password" | null;

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  STAFF: "Staff",
};

const ROLE_HINTS: Record<UserRole, string> = {
  ADMIN: "Full access to every module and admin tools.",
  STAFF: "Limited to POS and client bookings.",
};

const emptyForm = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "STAFF" as UserRole,
};

export default function AdminTeamPage() {
  const { user } = useAuth();
  const { confirm } = useConfirm();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<FormMode>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [form, setForm] = useState(emptyForm);

  const buildUrl = useCallback(
    (page: number, pageSize: number) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("search", search.trim());
      return `/api/team?${params}`;
    },
    [search]
  );

  const {
    items: members,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<TeamMember>(buildUrl, [search]);

  const stats = useMemo(() => {
    const admins = members.filter((m) => m.role === "ADMIN").length;
    const active = members.filter((m) => m.isActive).length;
    return {
      total: meta?.total ?? members.length,
      admins,
      active,
    };
  }, [members, meta]);

  function openCreate() {
    setMode("create");
    setEditing(null);
    setForm(emptyForm);
  }

  function openEdit(member: TeamMember) {
    setMode("edit");
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: "",
      confirmPassword: "",
      role: member.role,
    });
  }

  function openPasswordReset(member: TeamMember) {
    setMode("password");
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: "",
      confirmPassword: "",
      role: member.role,
    });
  }

  function closeSheet() {
    setMode(null);
    setEditing(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "password") {
      await handlePasswordSubmit();
      return;
    }
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    if (mode === "create" && form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      if (mode === "create") {
        const res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(messageFrom(json));
        toast.success(`Added ${json.data.name}`);
      } else if (mode === "edit" && editing) {
        const res = await fetch(`/api/team/${editing._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            role: form.role,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(messageFrom(json));
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

  async function handlePasswordSubmit() {
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!editing) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/team/${editing._id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(messageFrom(json));
      toast.success(`Password updated for ${editing.name}`);
      closeSheet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: TeamMember) {
    const next = !member.isActive;
    const label = next ? "reactivate" : "deactivate";
    const ok = await confirm({
      title: `${label.charAt(0).toUpperCase() + label.slice(1)} member?`,
      description: `"${member.name}" will be ${next ? "able to sign in again" : "blocked from signing in"}.`,
      confirmLabel: label.charAt(0).toUpperCase() + label.slice(1),
      variant: next ? "default" : "destructive",
      cancelToast: "Action cancelled",
    });
    if (!ok) return;
    const res = await fetch(`/api/team/${member._id}`, {
      method: next ? "PATCH" : "DELETE",
      headers: { "Content-Type": "application/json" },
      ...(next && { body: JSON.stringify({ isActive: true }) }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(messageFrom(json) ?? `Failed to ${label}`);
      return;
    }
    toast.success(next ? "Member reactivated" : "Member deactivated");
    await reload();
  }

  const statCards = [
    {
      label: "Team members",
      value: stats.total,
      icon: Users,
      tint: "bg-chart-1/10 text-chart-1",
    },
    {
      label: "Admins",
      value: stats.admins,
      icon: ShieldCheck,
      tint: "bg-chart-4/10 text-chart-4",
    },
    {
      label: "Active",
      value: stats.active,
      icon: CheckCircle2,
      tint: "bg-chart-5/10 text-chart-5",
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-500 sm:space-y-6">
      <ListPageHeader
        title="Team members"
        descriptionMobile="Manage staff access and roles."
        description="Add staff, set their password and role, and deactivate access when someone leaves."
        actions={
          <Button className="col-span-2 sm:col-span-1" onClick={openCreate}>
            <Plus className="size-4" />
            Add member
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

      <MobileFilterPanel>
        <MobileSearchField
          id="team-search"
          placeholder="Search name or email…"
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
            mobilePrimary: true,
            cell: (m: TeamMember) => (
              <div className="flex flex-col">
                <span className="font-medium">{m.name}</span>
                {user?._id === m._id && (
                  <span className="text-xs text-muted-foreground">You</span>
                )}
              </div>
            ),
          },
          {
            id: "email",
            header: "Email",
            hideOnMobile: true,
            cell: (m: TeamMember) => (
              <span className="text-sm">{m.email}</span>
            ),
          },
          {
            id: "role",
            header: "Role",
            cell: (m: TeamMember) => (
              <Badge variant={m.role === "ADMIN" ? "secondary" : "outline"}>
                {ROLE_LABELS[m.role]}
              </Badge>
            ),
          },
          {
            id: "status",
            header: "Status",
            cell: (m: TeamMember) =>
              m.isActive ? (
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
            cell: (m: TeamMember) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openEdit(m)}
                  aria-label={`Edit ${m.name}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => openPasswordReset(m)}
                  aria-label={`Reset password for ${m.name}`}
                >
                  <KeyRound className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleActive(m)}
                  disabled={user?._id === m._id}
                  aria-label={
                    m.isActive ? `Deactivate ${m.name}` : `Reactivate ${m.name}`
                  }
                >
                  {m.isActive ? (
                    <PauseCircle className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                </Button>
              </div>
            ),
          },
        ]}
        data={members}
        rowKey={(m) => m._id}
        loading={loading}
        emptyMessage="No team members yet. Click Add member to create one."
        meta={meta}
        onPageChange={setPage}
      />

      <Sheet open={mode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="flex flex-col p-0 sm:max-w-md">
          <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
            <SheetHeader className="border-b border-border/60">
              <SheetTitle>
                {mode === "create"
                  ? "Add team member"
                  : mode === "password"
                    ? "Reset password"
                    : "Edit team member"}
              </SheetTitle>
              <SheetDescription>
                {mode === "create"
                  ? "Set their login email, password, and access level."
                  : mode === "password"
                    ? `Set a new password for ${editing?.name ?? "this member"}. They will use it on next sign-in.`
                    : "Update name, email, or role."}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">
              {mode === "password" ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="reset-password">New password</Label>
                    <Input
                      id="reset-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 6 characters"
                      required
                      value={form.password}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, password: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reset-confirm">Confirm password</Label>
                    <Input
                      id="reset-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Re-enter password"
                      required
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : (
                <>
              <div className="space-y-2">
                <Label htmlFor="member-name">Name</Label>
                <Input
                  id="member-name"
                  required
                  autoComplete="off"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="member-email">Email</Label>
                <Input
                  id="member-email"
                  type="email"
                  required
                  autoComplete="off"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>

              {mode === "create" && (
                <div className="space-y-2">
                  <Label htmlFor="member-password">Password</Label>
                  <Input
                    id="member-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    required
                    value={form.password}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="member-role">Role</Label>
                <select
                  id="member-role"
                  className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      role: e.target.value as UserRole,
                    }))
                  }
                >
                  {USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {ROLE_HINTS[form.role]}
                </p>
              </div>
                </>
              )}
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t border-border/60">
              <Button type="button" variant="outline" onClick={closeSheet}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? "Saving…"
                  : mode === "create"
                    ? "Add member"
                    : mode === "password"
                      ? "Update password"
                      : "Save changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function messageFrom(json: unknown): string {
  if (json && typeof json === "object" && "error" in json) {
    const err = (json as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const flat = err as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[]>;
      };
      const first =
        flat.formErrors?.[0] ??
        Object.values(flat.fieldErrors ?? {})[0]?.[0];
      if (first) return first;
    }
  }
  return "Request failed";
}
