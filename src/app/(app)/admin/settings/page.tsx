"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mail, Rows3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSizeOption,
} from "@/domain/table-settings";
import { useTableSettings } from "@/lib/table-settings-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { springSmooth } from "@/lib/motion";

export default function AdminSettingsPage() {
  const { pageSize, setPageSize, loading } = useTableSettings();
  const [draft, setDraft] = useState<TablePageSizeOption>(pageSize);
  const [saving, setSaving] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [emailFrom, setEmailFrom] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    setDraft(pageSize);
  }, [pageSize]);

  useEffect(() => {
    fetch("/api/email/test")
      .then((r) => r.json())
      .then((json) => {
        setEmailConfigured(Boolean(json.data?.configured));
        setEmailFrom(json.data?.from ?? null);
      })
      .catch(() => setEmailConfigured(false));
  }, []);

  const dirty = draft !== pageSize;

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    const to = testTo.trim();
    if (!to) {
      toast.error("Enter a recipient email");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch("/api/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Send failed");
      toast.success(`Test email sent (id: ${json.data?.id ?? "ok"})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await setPageSize(draft);
      toast.success(`Default table size set to ${draft} rows`);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 max-w-2xl space-y-8 duration-500">
      <div>
        <h3 className="text-lg font-semibold">Table settings</h3>
        <p className="text-sm text-muted-foreground">
          Controls how many rows appear per page on Products, Inventory,
          Purchases, POS, and Businesses lists.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="card-elevated overflow-hidden rounded-2xl bg-card"
      >
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="brand-gradient flex size-10 items-center justify-center rounded-xl text-white shadow-sm shadow-primary/30">
            <Rows3 className="size-5" />
          </div>
          <div>
            <p className="font-medium">Default rows per page</p>
            <p className="text-xs text-muted-foreground">
              Applied platform-wide as the starting page size.
            </p>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <div className="space-y-3">
            <Label>Choose a default</Label>
            <div
              role="radiogroup"
              aria-label="Default rows per page"
              className="flex flex-wrap gap-2"
            >
              {TABLE_PAGE_SIZE_OPTIONS.map((n) => {
                const active = draft === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={loading}
                    onClick={() => setDraft(n)}
                    className={cn(
                      "relative cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      active
                        ? "text-white"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="rows-pill"
                        transition={springSmooth}
                        className="brand-gradient absolute inset-0 rounded-lg shadow-sm shadow-primary/30"
                      />
                    )}
                    <span className="relative z-10">{n} rows</span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Allowed values: {TABLE_PAGE_SIZE_OPTIONS.join(", ")}. Users can also
              change rows per page from the footer on any table.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving || loading || !dirty}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
            {dirty && !saving && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Sparkles className="size-3.5 text-primary" />
                Unsaved change
              </motion.span>
            )}
          </div>
        </div>
      </form>

      <div className="card-elevated overflow-hidden rounded-2xl bg-card">
        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-6 py-4">
          <div className="brand-gradient flex size-10 items-center justify-center rounded-xl text-white shadow-sm shadow-primary/30">
            <Mail className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">Email (Resend)</p>
            <p className="text-xs text-muted-foreground">
              Send a test message to verify your API key and sender address.
            </p>
          </div>
          {emailConfigured === null ? (
            <Badge variant="outline">Checking…</Badge>
          ) : emailConfigured ? (
            <Badge variant="secondary">Configured</Badge>
          ) : (
            <Badge variant="destructive">Not configured</Badge>
          )}
        </div>

        <form onSubmit={handleSendTest} className="space-y-4 p-6">
          {emailFrom && (
            <p className="text-sm text-muted-foreground">
              Sender: <span className="font-medium text-foreground">{emailFrom}</span>
            </p>
          )}
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Automatic emails</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Admins: low stock, credit sales, appointments, purchases</li>
              <li>Customers: receipts, credit invoices, payments, booking confirmations</li>
              <li>Team: welcome email when a member is added</li>
            </ul>
            <p className="mt-2">
              Optional: <code>NOTIFICATION_EMAIL</code> (admin alerts),{" "}
              <code>APP_URL</code> (login links in team emails)
            </p>
          </div>
          {!emailConfigured && emailConfigured !== null && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Add <code className="text-xs">RESEND_API_KEY</code> to{" "}
              <code className="text-xs">.env.local</code>, restart the dev server,
              then send a test. With Resend&apos;s sandbox sender{" "}
              <code className="text-xs">onboarding@resend.dev</code>, you can only
              deliver to the email on your Resend account.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="test-email-to">Send test to</Label>
            <Input
              id="test-email-to"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              disabled={!emailConfigured}
            />
          </div>
          <Button type="submit" disabled={!emailConfigured || sendingTest}>
            {sendingTest ? "Sending…" : "Send test email"}
          </Button>
        </form>
      </div>
    </div>
  );
}
