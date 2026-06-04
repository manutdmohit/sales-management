"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import type { UserRole } from "@/domain/roles";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  initialRole?: UserRole;
};

export function UserMenu({ initialRole }: Props) {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const role = user?.role ?? initialRole ?? "ADMIN";

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <div
        className="size-8 shrink-0 animate-pulse rounded-md bg-muted sm:w-28 sm:h-9"
        aria-hidden
      />
    );
  }

  if (!user) return null;

  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-3">
      <div className="hidden text-right text-sm sm:block">
        <div className="flex items-center justify-end gap-2">
          <p className="font-medium leading-none">{user.name}</p>
          <Badge variant={role === "ADMIN" ? "secondary" : "outline"}>
            {role === "ADMIN" ? "Admin" : "Staff"}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div
        className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex"
        title={user.name}
      >
        <User className="size-4" />
      </div>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label={loggingOut ? "Logging out" : "Log out"}
        className="shrink-0 touch-manipulation transition-all hover:border-destructive/40 hover:text-destructive sm:hidden"
      >
        <LogOut className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loggingOut}
        className="hidden shrink-0 transition-all hover:border-destructive/40 hover:text-destructive sm:inline-flex"
      >
        <LogOut className="size-4" />
        {loggingOut ? "…" : "Log out"}
      </Button>
    </div>
  );
}
