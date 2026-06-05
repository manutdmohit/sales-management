"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useBusiness } from "@/lib/business-context";
import { notifyNotificationsChanged } from "@/lib/notifications-client";
import { useConfirm } from "@/components/ui/confirm-provider";
import { usePaginatedList } from "@/lib/use-paginated-list";
import type { SortDir } from "@/lib/pagination";
import { hasFeature } from "@/domain/capabilities";
import type {
  Appointment,
  AppointmentStatus,
  PaymentMethod,
  PaymentReceipt,
  SaleType,
  Service,
} from "@/domain/types";
import { ReceiptUpload } from "@/components/receipts/receipt-upload";
import { ReceiptThumb } from "@/components/receipts/receipt-thumb";
import { TransactionReceiptsSection } from "@/components/receipts/payment-receipts";
import { TransactionEditForm } from "@/components/transactions/transaction-edit-form";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";
import { appointmentToTransactionRow } from "@/lib/appointment-transaction";
import {
  formatAppointmentSlot,
  formatDateTimeYmd,
  formatDateYmd,
} from "@/lib/format-datetime";
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
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

function statusVariant(
  status: AppointmentStatus
): "secondary" | "outline" | "destructive" {
  if (status === "COMPLETED") return "secondary";
  if (status === "CANCELLED" || status === "NO_SHOW") return "destructive";
  return "outline";
}

/** Format a Date into the `YYYY-MM-DDTHH:mm` value used by datetime-local. */
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Add minutes to a datetime-local string and return a datetime-local string. */
function addMinutes(localValue: string, minutes: number): string {
  const start = new Date(localValue);
  if (Number.isNaN(start.getTime())) return "";
  return toLocalInput(new Date(start.getTime() + minutes * 60_000));
}

const emptyForm = {
  serviceId: "",
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  startAt: "",
  endAt: "",
  followUpAt: "",
  notes: "",
};

export default function AppointmentsPage() {
  const { businessId, businesses, loading: businessLoading } = useBusiness();
  const { confirm } = useConfirm();
  const [services, setServices] = useState<Service[]>([]);
  const [saving, setSaving] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Appointment | null>(null);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("startAt");
  const [dir, setDir] = useState<SortDir>("asc");
  const [form, setForm] = useState(emptyForm);
  const [saleType, setSaleType] = useState<SaleType>("IMMEDIATE");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [downPayment, setDownPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceipt | null>(
    null
  );

  const selectedBusiness = businesses.find((b) => b._id === businessId);

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
      return `/api/appointments?${params}`;
    },
    [businessId, search, sort, dir]
  );

  const {
    items: appointments,
    meta,
    setPage,
    loading,
    reload,
  } = usePaginatedList<Appointment>(buildUrl, [businessId, search, sort, dir]);

  function handleSort(key: string, nextDir: SortDir) {
    setSort(key);
    setDir(nextDir);
  }

  useEffect(() => {
    if (!businessId) return;
    fetch(`/api/services?businessId=${businessId}`)
      .then((r) => r.json())
      .then((json) => setServices(json.data ?? []));
  }, [businessId]);

  const servicePrice =
    services.find((s) => s._id === form.serviceId)?.price ?? 0;
  const isCredit = saleType === "CREDIT";
  const paidNow = isCredit
    ? Math.min(Number(downPayment) || 0, servicePrice)
    : servicePrice;
  const outstanding = Math.max(0, servicePrice - paidNow);

  function resetPayment() {
    setSaleType("IMMEDIATE");
    setPaymentMethod("CASH");
    setDownPayment("");
    setDueDate("");
    setPaymentReceipt(null);
  }

  function openBooking() {
    setForm(emptyForm);
    resetPayment();
    setBookOpen(true);
  }

  function openView(a: Appointment) {
    setViewTarget(a);
  }

  function openEdit(a: Appointment) {
    setEditTarget(a);
  }

  function paymentLabel(a: Appointment): string {
    if (a.saleType === "CREDIT") {
      if (a.creditStatus === "PAID") return "Credit · paid";
      if (a.creditStatus === "PARTIAL") return "Credit · partial";
      return "Credit · pending";
    }
    return a.paymentMethod === "ONLINE" ? "Online" : "Cash";
  }

  const serviceDuration = useCallback(
    (serviceId: string) =>
      services.find((s) => s._id === serviceId)?.durationMinutes ?? 60,
    [services]
  );

  function handleServiceChange(serviceId: string) {
    setForm((f) => ({
      ...f,
      serviceId,
      endAt: f.startAt
        ? addMinutes(f.startAt, serviceDuration(serviceId))
        : f.endAt,
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
    if (isCredit && !dueDate) {
      toast.error("A due date is required for a credit booking");
      return;
    }

    const payload = {
      customerName: form.customerName,
      customerPhone: form.customerPhone.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      followUpAt: form.followUpAt
        ? new Date(form.followUpAt).toISOString()
        : undefined,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          serviceId: form.serviceId,
          ...payload,
          saleType,
          paymentMethod,
          ...(isCredit && {
            amountPaid: paidNow,
            dueDate: new Date(dueDate).toISOString(),
          }),
          ...(paymentReceipt && { paymentReceipt }),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const message =
          typeof json.error === "string"
            ? json.error
            : "Failed to book appointment";
        throw new Error(message);
      }
      toast.success(
        `Booked ${json.data.serviceName} for ${json.data.customerName}`
      );
      notifyNotificationsChanged();
      setBookOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(
    appointment: Appointment,
    status: AppointmentStatus
  ) {
    const res = await fetch(`/api/appointments/${appointment._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to update");
      return;
    }
    toast.success(`Marked ${STATUS_LABELS[status].toLowerCase()}`);
    if (viewTarget?._id === appointment._id && json.data) {
      setViewTarget(json.data as Appointment);
    }
    await reload();
  }

  async function handleCancel(appointment: Appointment) {
    const ok = await confirm({
      title: "Cancel this appointment?",
      description: `${appointment.serviceName} for ${appointment.customerName} will be cancelled and the time slot freed. You can reopen it later.`,
      confirmLabel: "Yes, cancel it",
      cancelLabel: "Keep it",
      variant: "destructive",
      cancelToast: "Appointment kept",
    });
    if (!ok) return;
    await setStatus(appointment, "CANCELLED");
  }

  if (businessLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!businessId || businesses.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <p className="text-muted-foreground">
          Select or create a business first.
        </p>
        <ButtonLink href="/admin/businesses" variant="outline">
          Go to Businesses
        </ButtonLink>
      </div>
    );
  }

  if (selectedBusiness && !hasFeature(selectedBusiness.type, "appointments")) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Appointments</h2>
        <p className="text-muted-foreground">
          The selected business type does not use appointments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <ListPageHeader
        title="Appointments"
        descriptionMobile={`Service bookings for ${selectedBusiness?.name ?? "this business"}.`}
        description={
          <>
            Book services and track follow-ups for{" "}
            <span className="font-medium text-foreground">
              {selectedBusiness?.name}
            </span>
            .
          </>
        }
        actions={
          <Button
            className="col-span-2 sm:col-span-1"
            onClick={openBooking}
            disabled={services.length === 0}
          >
            <CalendarPlus className="size-4" />
            Book appointment
          </Button>
        }
      />

      {services.length === 0 && (
        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
          Add a service first on the{" "}
          <ButtonLink href="/services" variant="link" className="px-1">
            Services
          </ButtonLink>{" "}
          page before booking appointments.
        </p>
      )}

      <MobileFilterPanel>
        <MobileSearchField
          id="appointment-search"
          placeholder="Search customer, phone or service…"
          value={search}
          onChange={setSearch}
          onPageReset={() => setPage(1)}
        />
      </MobileFilterPanel>

      <DataTable
        columns={[
          {
            id: "service",
            header: "Service",
            sortKey: "serviceName",
            mobilePrimary: true,
            cell: (a) => <span className="font-medium">{a.serviceName}</span>,
          },
          {
            id: "when",
            header: "When",
            sortKey: "startAt",
            mobileWrap: true,
            cell: (a) => {
              const { date, timeRange } = formatAppointmentSlot(a.startAt, a.endAt);
              return (
                <span className="block max-w-[7.5rem] truncate" title={`${date} ${timeRange}`}>
                  <span className="font-medium">{date}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {timeRange}
                  </span>
                </span>
              );
            },
          },
          {
            id: "customer",
            header: "Customer",
            sortKey: "customerName",
            hideOnMobile: true,
            cell: (a) => (
              <div>
                <div>{a.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {a.customerPhone}
                  {a.customerEmail ? ` · ${a.customerEmail}` : ""}
                </div>
              </div>
            ),
          },
          {
            id: "followup",
            header: "Follow-up",
            hideOnMobile: true,
            cell: (a) =>
              a.followUpAt
                ? formatDateYmd(a.followUpAt)
                : "—",
          },
          {
            id: "price",
            header: "Price",
            sortKey: "price",
            headerClassName: "text-right",
            className: "text-right font-mono",
            cell: (a) => a.price.toFixed(2),
          },
          {
            id: "receipt",
            header: "Receipt",
            hideOnMobile: true,
            cell: (a) => {
              const receipt =
                resolveAppointmentPayments(a).find((p) => p.receipt)?.receipt ??
                a.paymentReceipt;
              return receipt ? (
                <ReceiptThumb receipt={receipt} />
              ) : (
                <span className="text-muted-foreground">—</span>
              );
            },
          },
          {
            id: "status",
            header: "Status",
            sortKey: "status",
            cell: (a) => (
              <Badge variant={statusVariant(a.status)}>
                {STATUS_LABELS[a.status]}
              </Badge>
            ),
          },
          {
            id: "actions",
            header: "",
            mobileActions: true,
            headerClassName: "text-right",
            className: "text-right",
            cell: (a) => (
              <div className="flex flex-nowrap justify-end gap-0.5">
                <Button variant="ghost" size="sm" onClick={() => openView(a)}>
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(a)}>
                  Edit
                </Button>
                <div className="hidden md:contents">
                  {a.status === "BOOKED" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatus(a, "COMPLETED")}
                      >
                        Complete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setStatus(a, "NO_SHOW")}
                      >
                        No show
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancel(a)}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {(a.status === "CANCELLED" || a.status === "NO_SHOW") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus(a, "BOOKED")}
                    >
                      Reopen
                    </Button>
                  )}
                </div>
              </div>
            ),
          },
        ]}
        data={appointments}
        rowKey={(a) => a._id}
        loading={loading}
        emptyMessage="No appointments yet. Click Book appointment to schedule one."
        meta={meta}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={handleSort}
      />

      <Sheet open={bookOpen} onOpenChange={setBookOpen}>
        <SheetContent>
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>Book appointment</SheetTitle>
              <SheetDescription>
                Schedule a service and capture customer details.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <select
                  id="service"
                  required
                  className="h-9 w-full cursor-pointer rounded-md border bg-background px-3 text-sm"
                  value={form.serviceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  <option value="">Select service…</option>
                  {services.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.price.toFixed(2)})
                      {s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}
                    </option>
                  ))}
                </select>
              </div>
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
                  type="tel"
                  required
                  placeholder="98XXXXXXXX"
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
                  placeholder="name@example.com"
                  value={form.customerEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerEmail: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="startAt">From</Label>
                  <Input
                    id="startAt"
                    type="datetime-local"
                    required
                    value={form.startAt}
                    onChange={(e) => handleStartChange(e.target.value)}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="endAt">To</Label>
                  <Input
                    id="endAt"
                    type="datetime-local"
                    required
                    value={form.endAt}
                    min={form.startAt || undefined}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, endAt: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpAt">Follow-up date (optional)</Label>
                <Input
                  id="followUpAt"
                  type="date"
                  value={form.followUpAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, followUpAt: e.target.value }))
                  }
                />
              </div>

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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="booking-due">Due date</Label>
                    <Input
                      id="booking-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
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
                  id="appointment-receipt"
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
            </div>

            <SheetFooter className="flex-row justify-end gap-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBookOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : isCredit ? "Book on credit" : "Book"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={viewTarget !== null}
        onOpenChange={(open) => !open && setViewTarget(null)}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{viewTarget?.serviceName}</SheetTitle>
            <SheetDescription>{viewTarget?.customerName}</SheetDescription>
          </SheetHeader>
          {viewTarget && (
            <div className="space-y-5 px-4 pb-6">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                <dl className="space-y-2">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>
                      <Badge variant={statusVariant(viewTarget.status)}>
                        {STATUS_LABELS[viewTarget.status]}
                      </Badge>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Appointment</dt>
                    <dd className="text-right">
                      {formatAppointmentSlot(viewTarget.startAt, viewTarget.endAt).date}
                      <br />
                      <span className="text-muted-foreground">
                        {
                          formatAppointmentSlot(viewTarget.startAt, viewTarget.endAt)
                            .timeRange
                        }
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Booked on</dt>
                    <dd>{formatDateTimeYmd(viewTarget.createdAt)}</dd>
                  </div>
                  {viewTarget.followUpAt && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Follow-up</dt>
                      <dd>{formatDateYmd(viewTarget.followUpAt)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="font-mono font-semibold">
                      {viewTarget.price.toFixed(2)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>{paymentLabel(viewTarget)}</dd>
                  </div>
                  {viewTarget.notes && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd className="text-right">{viewTarget.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <TransactionReceiptsSection
                kind="BOOKING"
                paymentReceipt={viewTarget.paymentReceipt}
                payments={resolveAppointmentPayments(viewTarget)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewTarget(null);
                    openEdit(viewTarget);
                  }}
                >
                  Edit
                </Button>
                {viewTarget.status === "BOOKED" && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => void setStatus(viewTarget, "COMPLETED")}
                    >
                      Complete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void setStatus(viewTarget, "NO_SHOW")}
                    >
                      No show
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleCancel(viewTarget)}
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {(viewTarget.status === "CANCELLED" ||
                  viewTarget.status === "NO_SHOW") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void setStatus(viewTarget, "BOOKED")}
                  >
                    Reopen
                  </Button>
                )}
                {viewTarget.saleType === "CREDIT" &&
                  viewTarget.creditStatus !== "PAID" && (
                    <ButtonLink href="/receivables" variant="outline" size="sm">
                      Manage in receivables
                    </ButtonLink>
                  )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={editTarget !== null}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit appointment</SheetTitle>
            <SheetDescription>
              {editTarget?.serviceName} — {editTarget?.customerName}
            </SheetDescription>
          </SheetHeader>
          {editTarget && businessId && (
            <TransactionEditForm
              row={appointmentToTransactionRow(editTarget)}
              businessId={businessId}
              reopenOnSave={
                editTarget.status === "CANCELLED" ||
                editTarget.status === "NO_SHOW"
              }
              onCancel={() => setEditTarget(null)}
              onSaved={async () => {
                setEditTarget(null);
                notifyNotificationsChanged();
                await reload();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
