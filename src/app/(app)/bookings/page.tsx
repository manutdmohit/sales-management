"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Clock } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { hasFeature } from "@/domain/capabilities";
import type {
  Appointment,
  Client,
  PaymentMethod,
  PaymentReceipt,
  SaleType,
  Service,
} from "@/domain/types";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import { ReceiptThumb } from "@/components/receipts/receipt-thumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateYmd, formatTimeRange } from "@/lib/format-datetime";

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addMinutes(localValue: string, minutes: number): string {
  const start = new Date(localValue);
  if (Number.isNaN(start.getTime())) return "";
  return toLocalInput(new Date(start.getTime() + minutes * 60_000));
}

function startOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(`${dateStr}T23:59:59`);
  d.setHours(23, 59, 59, 999);
  return d;
}

function rangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

const emptyForm = {
  serviceId: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  startAt: "",
  endAt: "",
  notes: "",
};

export default function BookingsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saleType, setSaleType] = useState<SaleType>("IMMEDIATE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [downPayment, setDownPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(
    null
  );

  const selectedBusiness = businesses.find((b) => b._id === businessId);
  const hasBookings = hasFeature(selectedBusiness?.type, "appointments");

  const activeServices = useMemo(
    () => services.filter((s) => s.isActive),
    [services]
  );

  const servicePrice = useMemo(
    () => activeServices.find((s) => s._id === form.serviceId)?.price ?? 0,
    [activeServices, form.serviceId]
  );

  const isCredit = saleType === "CREDIT";
  const paidNow = isCredit
    ? Math.min(Number(downPayment) || 0, servicePrice)
    : servicePrice;
  const outstanding = Math.max(0, servicePrice - paidNow);

  const occupied = useMemo(
    () =>
      appointments.filter(
        (a) => a.status === "BOOKED" || a.status === "COMPLETED"
      ),
    [appointments]
  );

  const serviceDuration = useCallback(
    (serviceId: string) =>
      activeServices.find((s) => s._id === serviceId)?.durationMinutes ?? 60,
    [activeServices]
  );

  const loadSchedule = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
        from: startOfDay(day).toISOString(),
        to: endOfDay(day).toISOString(),
        page: "1",
        pageSize: "100",
      });
      const res = await fetch(`/api/appointments?${params}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load schedule");
      setAppointments(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }, [businessId, day]);

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/services?businessId=${businessId}`)
      .then((r) => r.json())
      .then((json) => setServices(json.data ?? []));
    fetch(`/api/clients?businessId=${businessId}&page=1&pageSize=200`)
      .then((r) => r.json())
      .then((json) => setClients(json.data ?? []));
  }, [businessId]);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const clientConflict = useMemo(() => {
    if (!form.startAt || !form.endAt) return null;
    const start = new Date(form.startAt);
    const end = new Date(form.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return (
      occupied.find((a) =>
        rangesOverlap(start, end, new Date(a.startAt), new Date(a.endAt))
      ) ?? null
    );
  }, [form.startAt, form.endAt, occupied]);

  function handleServiceChange(serviceId: string) {
    setForm((f) => ({
      ...f,
      serviceId,
      endAt: f.startAt
        ? addMinutes(f.startAt, serviceDuration(serviceId))
        : f.endAt,
    }));
  }

  function handleClientPick(clientId: string) {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c._id === clientId);
    if (!client) {
      setForm((f) => ({
        ...f,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      customerName: client.name,
      customerPhone: client.phone,
      customerEmail: client.email ?? "",
    }));
  }

  function handleStartChange(startAt: string) {
    setForm((f) => ({
      ...f,
      startAt,
      endAt: startAt ? addMinutes(startAt, serviceDuration(f.serviceId)) : "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    if (!form.serviceId) {
      toast.error("Select a service");
      return;
    }
    if (!form.customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!form.customerPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!form.startAt || !form.endAt) {
      toast.error("Pick a start and end time");
      return;
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      toast.error("End time must be after start time");
      return;
    }
    if (clientConflict) {
      toast.error(
        `That slot overlaps ${clientConflict.customerName} (${formatTimeRange(
          new Date(clientConflict.startAt),
          new Date(clientConflict.endAt)
        )})`
      );
      return;
    }
    if (isCredit && !dueDate) {
      toast.error("A due date is required for a credit booking");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          serviceId: form.serviceId,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          customerEmail: form.customerEmail.trim() || undefined,
          saleType,
          paymentMethod,
          ...(isCredit && {
            amountPaid: paidNow,
            dueDate: new Date(dueDate).toISOString(),
          }),
          ...(paymentReceipt && { paymentReceipt }),
          startAt: new Date(form.startAt).toISOString(),
          endAt: new Date(form.endAt).toISOString(),
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string"
            ? json.error
            : "Could not book this slot";
        throw new Error(message);
      }
      toast.success(
        isCredit
          ? `Booked ${json.data.serviceName} — ${outstanding.toFixed(2)} due`
          : `Booked ${json.data.serviceName} for ${json.data.customerName}`
      );
      notifyNotificationsChanged();
      setForm(emptyForm);
      setSelectedClientId("");
      setSaleType("IMMEDIATE");
      setPaymentMethod("CASH");
      setDownPayment("");
      setDueDate("");
      setPaymentReceipt(null);
      await loadSchedule();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
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
        <h2 className="text-2xl font-semibold">Client bookings</h2>
        <p className="text-muted-foreground">Select a business to continue.</p>
      </div>
    );
  }

  if (!hasBookings) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Client bookings</h2>
        <p className="text-muted-foreground">
          Booking schedule is available for service businesses (e.g. Magic Touch).
          Switch business from the header selector.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Client booking schedule
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Book clients without double booking — occupied slots are blocked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="schedule-day" className="sr-only">
            Day
          </Label>
          <Input
            id="schedule-day"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-auto"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarPlus className="size-4" />
              New booking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Service</Label>
                <select
                  id="serviceId"
                  required
                  className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  <option value="">Select service…</option>
                  {activeServices.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} — {s.price.toFixed(2)}
                      {s.durationMinutes ? ` (${s.durationMinutes} min)` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="existingClient">Existing client (optional)</Label>
                  <select
                    id="existingClient"
                    className="flex h-9 w-full cursor-pointer rounded-md border border-input bg-transparent px-3 text-sm"
                    value={selectedClientId}
                    onChange={(e) => handleClientPick(e.target.value)}
                  >
                    <option value="">New client / type manually…</option>
                    {clients.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} — {c.phone}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer name</Label>
                <Input
                  id="customerName"
                  required
                  value={form.customerName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  required
                  value={form.customerPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerPhone: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Email (optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={form.customerEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerEmail: e.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="startAt">From</Label>
                  <Input
                    id="startAt"
                    type="datetime-local"
                    required
                    value={form.startAt}
                    onChange={(e) => handleStartChange(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endAt">To</Label>
                  <Input
                    id="endAt"
                    type="datetime-local"
                    required
                    value={form.endAt}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endAt: e.target.value }))
                    }
                  />
                </div>
              </div>

              {clientConflict && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  Overlaps {clientConflict.customerName} (
                  {formatTimeRange(
                    new Date(clientConflict.startAt),
                    new Date(clientConflict.endAt)
                  )}
                  ). Choose another time.
                </p>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Settlement
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["IMMEDIATE", "CREDIT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSaleType(t)}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        saleType === t
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {t === "IMMEDIATE" ? "Pay now" : "Pay later"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {isCredit ? "Down payment method" : "Payment method"}
                </p>
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                  {(["CASH", "ONLINE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={cn(
                        "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        paymentMethod === m
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m === "CASH" ? "Cash" : "Online"}
                    </button>
                  ))}
                </div>
              </div>

              {isCredit && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="booking-due">Due date</Label>
                    <Input
                      id="booking-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="booking-paid">Paid now (optional)</Label>
                    <Input
                      id="booking-paid"
                      type="number"
                      min={0}
                      max={servicePrice}
                      step="0.01"
                      placeholder="0.00"
                      value={downPayment}
                      onChange={(e) => setDownPayment(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {isCredit ? "Outstanding" : "Total"}
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {(isCredit ? outstanding : servicePrice).toFixed(2)}
                </span>
              </div>

              {businessId && (paidNow > 0 || !isCredit) && (
                <ReceiptUpload
                  businessId={businessId}
                  category="appointments"
                  value={paymentReceipt}
                  onChange={setPaymentReceipt}
                  id="booking-receipt"
                  suggested={paymentMethod === "ONLINE" || paidNow > 0}
                  hint="Photo of QR, eSewa, Khalti, or bank transfer confirmation (optional)."
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input
                  id="notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                />
              </div>

              <Button type="submit" className="w-full" disabled={saving}>
                {saving
                  ? "Booking…"
                  : isCredit
                    ? "Book on credit"
                    : "Book appointment"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Schedule — {formatDateYmd(`${day}T12:00:00`)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading && (
              <p className="text-sm text-muted-foreground">Loading schedule…</p>
            )}
            {!loading && occupied.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No bookings yet for this day — all slots are free.
              </p>
            )}
            {!loading && occupied.length > 0 && (
              <ul className="space-y-3">
                {occupied.map((a) => (
                  <li
                    key={a._id}
                    className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3"
                  >
                    <div className="min-w-[7rem] text-sm font-medium tabular-nums">
                      {formatTimeRange(
                        new Date(a.startAt),
                        new Date(a.endAt)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{a.serviceName}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.customerName} · {a.customerPhone}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {a.saleType === "CREDIT" && (a.amountDue ?? 0) > 0 ? (
                          <span className="text-destructive">
                            Credit · {(a.amountDue ?? 0).toFixed(2)} due
                            {a.dueDate
                              ? ` by ${formatDateYmd(a.dueDate)}`
                              : ""}
                          </span>
                        ) : (
                          <>
                            Paid {(a.amountPaid ?? a.price).toFixed(2)}
                            {a.paymentMethod
                              ? ` · ${a.paymentMethod === "ONLINE" ? "Online" : "Cash"}`
                              : ""}
                          </>
                        )}
                      </p>
                    </div>
                    {a.paymentReceipt && (
                      <ReceiptThumb receipt={a.paymentReceipt} size={48} />
                    )}
                    <Badge variant="outline">{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}

            {!loading && appointments.some((a) => a.status === "CANCELLED") && (
              <div className="mt-6 border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Cancelled (slot freed)
                </p>
                <ul className="space-y-2">
                  {appointments
                    .filter((a) => a.status === "CANCELLED")
                    .map((a) => (
                      <li
                        key={a._id}
                        className={cn(
                          "text-sm text-muted-foreground line-through"
                        )}
                      >
                        {formatTimeRange(
                          new Date(a.startAt),
                          new Date(a.endAt)
                        )}{" "}
                        — {a.customerName}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
