import type { Appointment, SalePayment } from "@/domain/types";

/** Resolve payment ledger for appointments, including legacy paymentReceipt rows. */
export function resolveAppointmentPayments(
  appointment: Pick<
    Appointment,
    "payments" | "paymentReceipt" | "amountPaid" | "paymentMethod" | "createdAt"
  >
): SalePayment[] {
  if (appointment.payments?.length) return appointment.payments;
  const paid = appointment.amountPaid ?? 0;
  if (paid > 0 && appointment.paymentReceipt) {
    return [
      {
        amount: paid,
        method: appointment.paymentMethod ?? "CASH",
        at: appointment.createdAt,
        receipt: appointment.paymentReceipt,
      },
    ];
  }
  return [];
}

export function normalizeAppointment(appointment: Appointment): Appointment {
  const payments = resolveAppointmentPayments(appointment);
  if (payments === appointment.payments) return appointment;
  return { ...appointment, payments };
}
