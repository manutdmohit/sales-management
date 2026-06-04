import type { Appointment, TransactionListItem } from "@/domain/types";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";

const STATUS_LABELS: Record<string, string> = {
  BOOKED: "Booked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

/** Map an appointment to a ledger row for shared edit UI. */
export function appointmentToTransactionRow(
  appointment: Appointment
): TransactionListItem {
  return {
    _id: appointment._id,
    kind: "BOOKING",
    occurredAt: new Date(appointment.startAt),
    customerName: appointment.customerName,
    customerPhone: appointment.customerPhone,
    clientId: appointment.clientId,
    reference: appointment.serviceName,
    detail: STATUS_LABELS[appointment.status] ?? appointment.status,
    amount: appointment.price,
    paymentMethod: appointment.paymentMethod,
    saleType: appointment.saleType,
    creditStatus: appointment.creditStatus,
    status: appointment.status,
    startAt: new Date(appointment.startAt),
    endAt: new Date(appointment.endAt),
    bookedAt: new Date(appointment.createdAt),
    paymentReceipt: appointment.paymentReceipt,
    payments: resolveAppointmentPayments(appointment),
  };
}
