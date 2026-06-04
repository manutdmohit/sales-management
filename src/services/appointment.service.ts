import { AppError } from "@/lib/errors";
import { assertReceiptBelongsToBusiness } from "@/lib/cloudinary";
import { formatAppointmentSlot } from "@/lib/format-datetime";
import { eventBus } from "@/lib/events/event-bus";
import type { PaginatedResult, SortDir } from "@/lib/pagination";
import type { Appointment, CreditStatus } from "@/domain/types";
import { resolveAppointmentPayments } from "@/lib/appointment-payments";
import {
  applySettlementUpdate,
  deriveCreditStatus,
  hasSettlementInput,
} from "@/lib/settlement-update";
import { appointmentRepository } from "@/repositories/appointment.repository";
import { clientService } from "./client.service";
import { businessService } from "./business.service";
import { serviceCatalogService } from "./service-catalog.service";
import type { z } from "zod";
import type {
  createAppointmentSchema,
  updateAppointmentSchema,
} from "@/schemas/appointment.schema";
import type { recordPaymentSchema } from "@/schemas/sale.schema";

type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const appointmentService = {
  async getById(id: string): Promise<Appointment> {
    const appointment = await appointmentRepository.findById(id);
    if (!appointment) {
      throw new AppError("Appointment not found", 404, "NOT_FOUND");
    }
    return appointment;
  },

  async list(
    businessId: string,
    options?: {
      status?: string;
      search?: string;
      sort?: string;
      dir?: SortDir;
      from?: Date;
      to?: Date;
      page?: number;
      pageSize?: number;
    }
  ): Promise<PaginatedResult<Appointment>> {
    await businessService.getById(businessId);
    return appointmentRepository.findByBusinessPaginated(businessId, {
      status: options?.status,
      search: options?.search,
      sort: options?.sort,
      dir: options?.dir,
      from: options?.from,
      to: options?.to,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 10,
    });
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    await businessService.getById(input.businessId);
    const service = await serviceCatalogService.getById(input.serviceId);
    if (service.businessId !== input.businessId) {
      throw new AppError("Service does not belong to business", 400);
    }

    await ensureSlotAvailable(input.businessId, input.startAt, input.endAt);

    const client = await clientService.upsertFromContact({
      businessId: input.businessId,
      name: input.customerName,
      phone: input.customerPhone,
      email: input.customerEmail,
    });

    // Settlement mirrors POS: pay-now collects the full price; credit takes an
    // optional down-payment and tracks the outstanding balance + due date.
    const total = service.price;
    const isCredit = input.saleType === "CREDIT";
    const amountPaid = isCredit
      ? Math.min(input.amountPaid ?? 0, total)
      : total;
    const amountDue = Math.max(0, total - amountPaid);
    const creditStatus: CreditStatus | undefined = isCredit
      ? deriveCreditStatus(total, amountPaid)
      : undefined;

    if (input.paymentReceipt) {
      assertReceiptBelongsToBusiness(
        input.paymentReceipt,
        input.businessId,
        "appointments"
      );
    }

    const now = new Date();
    const payments =
      amountPaid > 0
        ? [
            {
              amount: amountPaid,
              method: input.paymentMethod,
              at: now,
              ...(input.paymentReceipt && { receipt: input.paymentReceipt }),
            },
          ]
        : [];

    const appointment = await appointmentRepository.create({
      businessId: input.businessId,
      serviceId: service._id,
      serviceName: service.name,
      clientId: client._id,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      price: service.price,
      saleType: input.saleType,
      paymentMethod: input.paymentMethod,
      amountPaid,
      amountDue,
      creditStatus,
      dueDate: isCredit ? input.dueDate : undefined,
      paymentReceipt: input.paymentReceipt,
      payments,
      startAt: input.startAt,
      endAt: input.endAt,
      followUpAt: input.followUpAt,
      status: "BOOKED",
      notes: input.notes,
    });

    await eventBus.emit({
      type: "APPOINTMENT_BOOKED",
      businessId: input.businessId,
      payload: {
        appointmentId: appointment._id,
        serviceId: service._id,
        serviceName: service.name,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        price: appointment.price,
        amountDue: appointment.amountDue,
        dueDate: appointment.dueDate,
      },
      timestamp: new Date(),
    });

    return appointment;
  },

  async update(
    id: string,
    input: UpdateAppointmentInput
  ): Promise<Appointment> {
    const existing = await appointmentRepository.findById(id);
    if (!existing) {
      throw new AppError("Appointment not found", 404, "NOT_FOUND");
    }

    // Re-check slot availability when the appointment will occupy a slot and
    // either its time frame changed or it is transitioning back into an
    // occupying state (e.g. un-cancelling a previously freed slot).
    const startAt = input.startAt ?? existing.startAt;
    const endAt = input.endAt ?? existing.endAt;
    const nextStatus = input.status ?? existing.status;
    const timeChanged = Boolean(input.startAt || input.endAt);
    const willOccupy = nextStatus === "BOOKED" || nextStatus === "COMPLETED";
    const didOccupy =
      existing.status === "BOOKED" || existing.status === "COMPLETED";
    if (willOccupy && (timeChanged || !didOccupy)) {
      await ensureSlotAvailable(existing.businessId, startAt, endAt, id);
    }

    let clientId = existing.clientId;
    if (input.customerName || input.customerPhone || input.customerEmail) {
      const client = await clientService.upsertFromContact({
        businessId: existing.businessId,
        name: input.customerName ?? existing.customerName,
        phone: input.customerPhone ?? existing.customerPhone,
        email: input.customerEmail ?? existing.customerEmail,
      });
      clientId = client._id;
    }

    const paymentPatch = applyAppointmentPaymentUpdate(existing, input);

    const updated = await appointmentRepository.update(id, {
      ...input,
      ...(clientId ? { clientId } : {}),
      ...(paymentPatch ?? {}),
    });
    if (!updated) {
      throw new AppError("Appointment not found", 404, "NOT_FOUND");
    }
    return updated;
  },

  /** Record a payment against a credit booking and recompute its balance. */
  async recordPayment(
    appointmentId: string,
    input: RecordPaymentInput
  ): Promise<Appointment> {
    const appointment = await appointmentRepository.findById(appointmentId);
    if (!appointment) {
      throw new AppError("Appointment not found", 404, "NOT_FOUND");
    }
    if (appointment.saleType !== "CREDIT") {
      throw new AppError("Only credit bookings accept payments", 400);
    }
    if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") {
      throw new AppError("Cannot collect payment on a cancelled booking", 400);
    }
    const outstanding = appointment.amountDue ?? 0;
    if (outstanding <= 0) {
      throw new AppError("This booking is already fully paid", 400);
    }
    if (input.amount > outstanding + 1e-6) {
      throw new AppError(
        `Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`,
        400
      );
    }

    const existingPayments = appointment.payments ?? [];
    const amountPaid = (appointment.amountPaid ?? 0) + input.amount;
    const amountDue = Math.max(0, appointment.price - amountPaid);
    const creditStatus = deriveCreditStatus(appointment.price, amountPaid);
    if (input.receipt) {
      assertReceiptBelongsToBusiness(
        input.receipt,
        appointment.businessId,
        "appointments"
      );
    }
    const payment = {
      amount: input.amount,
      method: input.method,
      at: new Date(),
      note: input.note,
      ...(input.receipt && { receipt: input.receipt }),
    };

    const updated = await appointmentRepository.update(appointmentId, {
      amountPaid,
      amountDue,
      creditStatus,
      payments: [...existingPayments, payment],
    });
    if (!updated) {
      throw new AppError("Appointment not found", 404, "NOT_FOUND");
    }

    await eventBus.emit({
      type: "PAYMENT_RECORDED",
      businessId: appointment.businessId,
      payload: {
        appointmentId,
        amount: input.amount,
        amountDue,
        creditStatus,
        method: input.method,
      },
      timestamp: new Date(),
    });

    return updated;
  },
};

function applyAppointmentPaymentUpdate(
  existing: Appointment,
  input: UpdateAppointmentInput
): Partial<Appointment> | null {
  if (!hasSettlementInput(input)) return null;

  if (existing.status === "CANCELLED" || existing.status === "NO_SHOW") {
    throw new AppError("Cannot change payment on a cancelled booking", 400);
  }

  const existingPayments = resolveAppointmentPayments(existing);
  const settlement = applySettlementUpdate({
    total: existing.price,
    existing: {
      saleType: existing.saleType,
      paymentMethod: existing.paymentMethod,
      amountPaid: existing.amountPaid,
      dueDate: existing.dueDate,
      paymentReceipt: existing.paymentReceipt,
      payments: existingPayments,
    },
    input: {
      saleType: input.saleType,
      paymentMethod: input.paymentMethod,
      amountPaid: input.amountPaid,
      dueDate: input.dueDate,
      paymentReceipt: input.paymentReceipt,
    },
    businessId: existing.businessId,
    receiptCategory: "appointments",
  });

  return settlement ?? null;
}

async function ensureSlotAvailable(
  businessId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string
): Promise<void> {
  const clash = await appointmentRepository.findOverlapping(
    businessId,
    startAt,
    endAt,
    excludeId
  );
  if (clash) {
    const slot = formatAppointmentSlot(clash.startAt, clash.endAt);
    throw new AppError(
      `That time frame overlaps an existing appointment (${slot.date} ${slot.timeRange}). Pick another slot.`,
      409,
      "SLOT_TAKEN"
    );
  }
}
