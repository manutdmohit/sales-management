"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ClientEmailTarget = {
  _id: string;
  name: string;
  email?: string;
};

type ClientEmailSheetProps = {
  client: ClientEmailTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
};

export function ClientEmailSheet({
  client,
  open,
  onOpenChange,
  onSent,
}: ClientEmailSheetProps) {
  const { businesses, businessId } = useBusiness();
  const business = businesses.find((b) => b._id === businessId);

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !client) return;
    setTo(client.email ?? "");
    setSubject(business ? `Message from ${business.name}` : "Message from us");
    setMessage("");
  }, [open, client, business]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client._id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          ...(to.trim() ? { to: to.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const err =
          typeof json.error === "string"
            ? json.error
            : "Failed to send email";
        throw new Error(err);
      }
      toast.success(`Email sent to ${to.trim() || client.email}`);
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="font-sans sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Mail className="size-4" />
              Email client
            </SheetTitle>
            <SheetDescription>
              {client
                ? `Send a message to ${client.name}. They can reply to your login email.`
                : "Compose a message"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-2">
              <Label htmlFor="client-email-to">To</Label>
              <Input
                id="client-email-to"
                type="email"
                required
                placeholder="client@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              {!client?.email && (
                <p className="text-xs text-muted-foreground">
                  No email on file — enter an address to send.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email-subject">Subject</Label>
              <Input
                id="client-email-subject"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client-email-message">Message</Label>
              <textarea
                id="client-email-message"
                required
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message…"
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !client}>
              {saving ? "Sending…" : "Send email"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function ClientEmailButton({
  client,
  variant = "outline",
  size = "sm",
  className,
}: {
  client: ClientEmailTarget;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={`Email ${client.name}`}
      >
        <Mail className="size-3.5" />
        {size !== "icon" && "Email"}
      </Button>
      <ClientEmailSheet client={client} open={open} onOpenChange={setOpen} />
    </>
  );
}
