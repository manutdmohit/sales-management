"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CalendarX,
  CheckCheck,
  Receipt,
  Trash2,
  Clock,
  HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { NOTIFICATIONS_CHANGED_EVENT } from "@/lib/notifications-client";
import type { Notification, NotificationType } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { cn } from "@/lib/utils";
import { formatDateTimeYmd } from "@/lib/format-datetime";

const POLL_MS = 5_000;

function iconForType(type: NotificationType) {
  switch (type) {
    case "LOW_STOCK":
      return AlertTriangle;
    case "CREDIT_SALE":
      return Receipt;
    case "CREDIT_DUE_REMINDER":
      return Clock;
    case "APPOINTMENT_BOOKED":
      return CalendarClock;
    case "FOLLOWUP_REMINDER":
      return HeartHandshake;
    case "EXPIRY_WARNING":
      return AlertTriangle;
    case "EXPIRY_CRITICAL":
      return CalendarX;
    default:
      return Bell;
  }
}

function hrefForNotification(n: Notification): string | null {
  if (n.referenceType === "product") return "/inventory";
  if (n.referenceType === "batch") return "/inventory";
  if (n.referenceType === "sale") return "/receivables";
  if (n.referenceType === "appointment") return "/appointments";
  return null;
}

function tintForType(type: NotificationType): string {
  switch (type) {
    case "LOW_STOCK":
      return "bg-destructive/10 text-destructive";
    case "CREDIT_SALE":
      return "bg-chart-1/10 text-chart-1";
    case "CREDIT_DUE_REMINDER":
      return "bg-chart-3/10 text-chart-3";
    case "APPOINTMENT_BOOKED":
      return "bg-chart-2/10 text-chart-2";
    case "FOLLOWUP_REMINDER":
      return "bg-chart-4/10 text-chart-4";
    case "EXPIRY_WARNING":
      return "bg-chart-3/10 text-chart-3";
    case "EXPIRY_CRITICAL":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function NotificationBell() {
  const { businessId } = useBusiness();
  const { confirm } = useConfirm();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const refreshCount = useCallback(async () => {
    if (!businessId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch(
        `/api/notifications?businessId=${businessId}&countOnly=true`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const json = await res.json();
      setUnreadCount(json.data?.count ?? 0);
    } catch {
      // Ignore transient network errors during background polling.
    }
  }, [businessId]);

  const refreshList = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!businessId) {
        setItems([]);
        return;
      }
      if (!options?.silent) setLoading(true);
      try {
        const res = await fetch(
          `/api/notifications?businessId=${businessId}&unreadOnly=false&page=1&pageSize=8`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const json = await res.json();
        setItems(json.data ?? []);
      } finally {
        if (!options?.silent) setLoading(false);
      }
    },
    [businessId]
  );

  const refreshAll = useCallback(
    async (options?: { silent?: boolean }) => {
      await Promise.all([
        refreshCount(),
        refreshList(options),
      ]);
    },
    [refreshCount, refreshList]
  );

  useEffect(() => {
    if (!businessId) {
      setUnreadCount(0);
      setItems([]);
      return;
    }

    void refreshCount();
    if (open) void refreshList();

    const tick = () => {
      void refreshCount();
      if (openRef.current) void refreshList({ silent: true });
    };

    const intervalId = window.setInterval(tick, POLL_MS);
    const onChanged = () => tick();
    const onFocus = () => tick();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [businessId, open, refreshCount, refreshList]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    await refreshAll({ silent: true });
  }

  async function markAllRead() {
    if (!businessId) return;
    await fetch("/api/notifications/read-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });
    await refreshAll({ silent: true });
  }

  async function removeNotification(notification: Notification) {
    const ok = await confirm({
      title: "Are you sure you want to remove this notification?",
      description: `"${notification.title}" will be permanently deleted.`,
      confirmLabel: "Yes, remove it",
      cancelLabel: "Keep it",
      variant: "warning",
      cancelToast: "Notification kept",
    });
    if (!ok) return;

    const res = await fetch(`/api/notifications/${notification._id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to remove notification");
      return;
    }
    toast.success("Notification removed");
    await refreshAll({ silent: true });
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="relative shrink-0 touch-manipulation"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-live="polite"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void refreshAll();
        }}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border/60 bg-popover shadow-lg sm:w-96">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Loading…
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            )}
            {!loading &&
              items.map((n) => {
                const Icon = iconForType(n.type);
                const href = hrefForNotification(n);
                const content = (
                  <div
                    className={cn(
                      "flex gap-3 px-4 py-3 transition-colors hover:bg-muted/60",
                      !n.isRead && "bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        tintForType(n.type)
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">
                        {n.title}
                        {!n.isRead && (
                          <span className="ml-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" />
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDateTimeYmd(n.createdAt)}
                      </p>
                    </div>
                  </div>
                );

                return (
                  <div
                    key={n._id}
                    className="group relative border-b border-border/40 last:border-0"
                  >
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          if (!n.isRead) void markRead(n._id);
                          setOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="w-full cursor-pointer text-left"
                        onClick={() => {
                          if (!n.isRead) void markRead(n._id);
                        }}
                      >
                        {content}
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Remove notification: ${n.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void removeNotification(n);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
