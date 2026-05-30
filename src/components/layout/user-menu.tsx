"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

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
      <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
    );
  }

  if (!user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right text-sm sm:block">
        <p className="font-medium leading-none">{user.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
      </div>
      <div
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"
        title={user.name}
      >
        <User className="size-4" />
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={loggingOut}
        className="transition-all hover:border-destructive/40 hover:text-destructive"
      >
        <LogOut className="size-4" />
        {loggingOut ? "…" : "Log out"}
      </Button>
    </div>
  );
}
