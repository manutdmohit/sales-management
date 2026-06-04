import type { Appointment, Sale } from "@/domain/types";
import type { ReminderKind } from "@/domain/reminders";
import { reminderDedupeKey } from "@/domain/reminders";
import { emailTemplates } from "@/lib/email/templates";
import { getAdminNotificationEmails, getAppLoginUrl } from "@/lib/email/recipients";
import { calendarDayRange, formatCalendarDate } from "@/lib/reminder-dates";
import { appointmentRepository } from "@/repositories/appointment.repository";
import { clientRepository } from "@/repositories/client.repository";
import { reminderDispatchRepository } from "@/repositories/reminder-dispatch.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { businessService } from "./business.service";
import { emailService } from "./email.service";
import { notificationService } from "./notification.service";

export type ReminderRunResult = {
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
};

type DayRange = ReturnType<typeof calendarDayRange>;

function timingForKind(kind: ReminderKind): "before" | "on" {
  return kind.endsWith("_DAY_BEFORE") ? "before" : "on";
}

function notificationDedupeKey(
  kind: ReminderKind,
  referenceType: "sale" | "appointment",
  referenceId: string,
  anchorDate: string
): string {
  return `reminder:${reminderDedupeKey(kind, referenceType, referenceId, anchorDate)}`;
}

async function resolveCustomerEmail(
  sale: Sale
): Promise<string | undefined> {
  const direct = sale.customer?.email?.trim();
  if (direct) return direct;
  if (!sale.clientId) return undefined;
  const client = await clientRepository.findById(sale.clientId);
  return client?.email?.trim() || undefined;
}

async function dispatchCreditSaleReminder(
  sale: Sale,
  kind: ReminderKind,
  range: DayRange
): Promise<void> {
  if (!sale.dueDate) return;

  const business = await businessService.getById(sale.businessId);
  const timing = timingForKind(kind);
  const anchorDate = range.key;
  const customerName = sale.customer?.name ?? "Customer";
  const loginUrl = `${getAppLoginUrl().replace(/\/login$/, "")}/receivables`;

  const title =
    timing === "before"
      ? `Credit due tomorrow — ${sale.invoiceNumber}`
      : `Credit due today — ${sale.invoiceNumber}`;
  const message = `${customerName} owes ${sale.amountDue.toFixed(2)} due ${formatCalendarDate(sale.dueDate)}.`;

  await notificationService.create({
    businessId: sale.businessId,
    type: "CREDIT_DUE_REMINDER",
    title,
    message,
    referenceType: "sale",
    referenceId: sale._id,
    dedupeKey: notificationDedupeKey(kind, "sale", sale._id, anchorDate),
  });

  const adminEmails = await getAdminNotificationEmails();
  if (adminEmails.length > 0) {
    const adminMail = emailTemplates.creditDueReminderAdmin({
      businessName: business.name,
      timing,
      source: "sale",
      label: sale.invoiceNumber,
      customerName,
      amountDue: sale.amountDue,
      dueDate: sale.dueDate,
      loginUrl,
    });
    await emailService.sendSafe({ to: adminEmails, ...adminMail });
  }

  const customerEmail = await resolveCustomerEmail(sale);
  if (customerEmail) {
    const customerMail = emailTemplates.creditDueReminderCustomer({
      businessName: business.name,
      timing,
      customerName,
      label: sale.invoiceNumber,
      amountDue: sale.amountDue,
      dueDate: sale.dueDate,
    });
    await emailService.sendSafe({ to: customerEmail, ...customerMail });
  }
}

async function dispatchCreditAppointmentReminder(
  appointment: Appointment,
  kind: ReminderKind,
  range: DayRange
): Promise<void> {
  if (!appointment.dueDate) return;

  const business = await businessService.getById(appointment.businessId);
  const timing = timingForKind(kind);
  const anchorDate = range.key;
  const loginUrl = `${getAppLoginUrl().replace(/\/login$/, "")}/receivables`;

  const amountDue = appointment.amountDue ?? 0;
  const title =
    timing === "before"
      ? `Credit due tomorrow — ${appointment.serviceName}`
      : `Credit due today — ${appointment.serviceName}`;
  const message = `${appointment.customerName} owes ${amountDue.toFixed(2)} for ${appointment.serviceName} due ${formatCalendarDate(appointment.dueDate)}.`;

  await notificationService.create({
    businessId: appointment.businessId,
    type: "CREDIT_DUE_REMINDER",
    title,
    message,
    referenceType: "appointment",
    referenceId: appointment._id,
    dedupeKey: notificationDedupeKey(
      kind,
      "appointment",
      appointment._id,
      anchorDate
    ),
  });

  const adminEmails = await getAdminNotificationEmails();
  if (adminEmails.length > 0) {
    const adminMail = emailTemplates.creditDueReminderAdmin({
      businessName: business.name,
      timing,
      source: "appointment",
      label: appointment.serviceName,
      customerName: appointment.customerName,
      amountDue,
      dueDate: appointment.dueDate,
      loginUrl,
    });
    await emailService.sendSafe({ to: adminEmails, ...adminMail });
  }

  const customerEmail = appointment.customerEmail?.trim();
  if (customerEmail) {
    const customerMail = emailTemplates.creditDueReminderCustomer({
      businessName: business.name,
      timing,
      customerName: appointment.customerName,
      label: appointment.serviceName,
      amountDue,
      dueDate: appointment.dueDate,
    });
    await emailService.sendSafe({ to: customerEmail, ...customerMail });
  }
}

async function dispatchFollowUpReminder(
  appointment: Appointment,
  kind: ReminderKind,
  range: DayRange
): Promise<void> {
  if (!appointment.followUpAt) return;

  const business = await businessService.getById(appointment.businessId);
  const timing = timingForKind(kind);
  const anchorDate = range.key;
  const loginUrl = `${getAppLoginUrl().replace(/\/login$/, "")}/appointments`;

  const title =
    timing === "before"
      ? `Follow-up tomorrow — ${appointment.customerName}`
      : `Follow-up today — ${appointment.customerName}`;
  const message = `${appointment.serviceName} follow-up on ${formatCalendarDate(appointment.followUpAt)}.`;

  await notificationService.create({
    businessId: appointment.businessId,
    type: "FOLLOWUP_REMINDER",
    title,
    message,
    referenceType: "appointment",
    referenceId: appointment._id,
    dedupeKey: notificationDedupeKey(
      kind,
      "appointment",
      appointment._id,
      anchorDate
    ),
  });

  const adminEmails = await getAdminNotificationEmails();
  if (adminEmails.length > 0) {
    const adminMail = emailTemplates.followUpReminderAdmin({
      businessName: business.name,
      timing,
      serviceName: appointment.serviceName,
      customerName: appointment.customerName,
      customerPhone: appointment.customerPhone,
      followUpAt: appointment.followUpAt,
      loginUrl,
    });
    await emailService.sendSafe({ to: adminEmails, ...adminMail });
  }

  const customerEmail = appointment.customerEmail?.trim();
  if (customerEmail) {
    const customerMail = emailTemplates.followUpReminderCustomer({
      businessName: business.name,
      timing,
      customerName: appointment.customerName,
      serviceName: appointment.serviceName,
      followUpAt: appointment.followUpAt,
    });
    await emailService.sendSafe({ to: customerEmail, ...customerMail });
  }
}

async function processBatch<T>(items: T[], kind: ReminderKind, range: DayRange, handler: (item: T, kind: ReminderKind, range: DayRange) => Promise<void>, referenceType: "sale" | "appointment", getId: (item: T) => string, result: ReminderRunResult): Promise<void> {
  for (const item of items) {
    result.processed++;
    const referenceId = getId(item);
    const claimed = await reminderDispatchRepository.tryClaim({
      businessId: (item as { businessId: string }).businessId,
      kind,
      referenceType,
      referenceId,
      anchorDate: range.key,
    });
    if (!claimed) {
      result.skipped++;
      continue;
    }
    try {
      await handler(item, kind, range);
      result.sent++;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Unknown reminder error";
      result.errors.push(`${kind}:${referenceType}:${referenceId}: ${msg}`);
    }
  }
}

export const reminderService = {
  /** Run all due reminders for today (and tomorrow for day-before alerts). */
  async runDueReminders(asOf = new Date()): Promise<ReminderRunResult> {
    const result: ReminderRunResult = {
      processed: 0,
      sent: 0,
      skipped: 0,
      errors: [],
    };

    const today = calendarDayRange(0, asOf);
    const tomorrow = calendarDayRange(1, asOf);

    const [creditSalesTomorrow, creditSalesToday, creditApptTomorrow, creditApptToday, followUpTomorrow, followUpToday] =
      await Promise.all([
        saleRepository.findCreditDueBetween(tomorrow.start, tomorrow.end),
        saleRepository.findCreditDueBetween(today.start, today.end),
        appointmentRepository.findCreditDueBetween(tomorrow.start, tomorrow.end),
        appointmentRepository.findCreditDueBetween(today.start, today.end),
        appointmentRepository.findFollowUpBetween(tomorrow.start, tomorrow.end),
        appointmentRepository.findFollowUpBetween(today.start, today.end),
      ]);

    await processBatch(
      creditSalesTomorrow,
      "CREDIT_DUE_DAY_BEFORE",
      tomorrow,
      dispatchCreditSaleReminder,
      "sale",
      (s) => s._id,
      result
    );
    await processBatch(
      creditSalesToday,
      "CREDIT_DUE_ON",
      today,
      dispatchCreditSaleReminder,
      "sale",
      (s) => s._id,
      result
    );
    await processBatch(
      creditApptTomorrow,
      "CREDIT_DUE_DAY_BEFORE",
      tomorrow,
      dispatchCreditAppointmentReminder,
      "appointment",
      (a) => a._id,
      result
    );
    await processBatch(
      creditApptToday,
      "CREDIT_DUE_ON",
      today,
      dispatchCreditAppointmentReminder,
      "appointment",
      (a) => a._id,
      result
    );
    await processBatch(
      followUpTomorrow,
      "FOLLOWUP_DAY_BEFORE",
      tomorrow,
      dispatchFollowUpReminder,
      "appointment",
      (a) => a._id,
      result
    );
    await processBatch(
      followUpToday,
      "FOLLOWUP_ON",
      today,
      dispatchFollowUpReminder,
      "appointment",
      (a) => a._id,
      result
    );

    return result;
  },
};
