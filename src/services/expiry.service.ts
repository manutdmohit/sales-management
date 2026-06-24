import type { Batch, NotificationType } from "@/domain/types";
import type { ExpiryAlertLevel } from "@/domain/expiry";
import { expiryAlertLevel } from "@/domain/expiry";
import type { ReminderKind } from "@/domain/reminders";
import { emailTemplates } from "@/lib/email/templates";
import { getAdminNotificationEmails, getAppLoginUrl } from "@/lib/email/recipients";
import { formatCalendarDate } from "@/lib/reminder-dates";
import { calendarDayRange } from "@/lib/reminder-dates";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { batchRepository } from "@/repositories/batch.repository";
import { notificationRepository } from "@/repositories/notification.repository";
import { productRepository } from "@/repositories/product.repository";
import { reminderDispatchRepository } from "@/repositories/reminder-dispatch.repository";
import { businessService } from "./business.service";
import { emailService } from "./email.service";
import { notificationService } from "./notification.service";

export type ExpiryRunResult = {
  processed: number;
  sent: number;
  skipped: number;
  warnings: number;
  critical: number;
  errors: string[];
};

type EnrichedBatch = Batch & {
  productName: string;
  sku: string;
  unitId?: string;
  level: ExpiryAlertLevel;
};

function reminderKindForLevel(level: ExpiryAlertLevel): ReminderKind {
  return level === "critical" ? "EXPIRY_CRITICAL" : "EXPIRY_WARNING";
}

function notificationTypeForLevel(level: ExpiryAlertLevel) {
  return level === "critical" ? "EXPIRY_CRITICAL" : "EXPIRY_WARNING";
}

async function enrichBatches(
  batches: Batch[],
  asOf: Date
): Promise<EnrichedBatch[]> {
  const productIds = [...new Set(batches.map((batch) => batch.productId))];
  const products = await productRepository.findByIds(productIds);
  const productMap = new Map(products.map((product) => [product._id, product]));

  const enriched: EnrichedBatch[] = [];
  for (const batch of batches) {
    if (!batch.expiryDate) continue;
    const level = expiryAlertLevel(new Date(batch.expiryDate), asOf);
    if (!level) continue;

    const product = productMap.get(batch.productId);
    if (!product || !product.trackExpiry) continue;

    enriched.push({
      ...batch,
      productName: product.name,
      sku: product.sku,
      unitId: product.unitId,
      level,
    });
  }
  return enriched;
}

function buildBatchAlertNotification(batch: EnrichedBatch): {
  businessId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: "batch";
  referenceId: string;
  dedupeKey: string;
} {
  const level = batch.level;
  const qtyLabel = formatQuantityWithUnit(
    batch.remainingQuantity,
    batch.unitId
  );
  const expiryLabel = formatCalendarDate(batch.expiryDate!);
  const isCritical = level === "critical";
  const type = notificationTypeForLevel(level);

  return {
    businessId: batch.businessId,
    type,
    title: isCritical
      ? `Expired batch — ${batch.productName}`
      : `Expiring soon — ${batch.productName}`,
    message: isCritical
      ? `Batch ${batch.batchNumber} expired ${expiryLabel} with ${qtyLabel} remaining (${batch.sku}).`
      : `Batch ${batch.batchNumber} expires ${expiryLabel} — ${qtyLabel} on hand (${batch.sku}).`,
    referenceType: "batch" as const,
    referenceId: batch._id,
    dedupeKey: `${type}:${batch._id}`,
  };
}

async function dispatchBatchAlert(batch: EnrichedBatch): Promise<void> {
  const business = await businessService.getById(batch.businessId);
  const level = batch.level;
  const loginUrl = `${getAppLoginUrl().replace(/\/login$/, "")}/inventory`;

  await notificationService.createOrRefresh(
    buildBatchAlertNotification(batch),
    { markUnread: true }
  );

  const adminEmails = await getAdminNotificationEmails();
  if (adminEmails.length === 0) return;

  const mailInput = {
    businessName: business.name,
    productName: batch.productName,
    sku: batch.sku,
    batchNumber: batch.batchNumber,
    remainingQuantity: batch.remainingQuantity,
    unitId: batch.unitId,
    expiryDate: new Date(batch.expiryDate!),
    loginUrl,
  };

  const mail = level === "critical"
    ? emailTemplates.expiryCritical(mailInput)
    : emailTemplates.expiryWarning(mailInput);

  await emailService.sendSafe({ to: adminEmails, ...mail });
}

export const expiryService = {
  async listAlerts(
    businessId: string,
    asOf = new Date()
  ): Promise<EnrichedBatch[]> {
    await businessService.getById(businessId);
    const batches = await batchRepository.findActiveWithExpiry(businessId);
    return enrichBatches(batches, asOf);
  },

  /** Keep in-app notifications in sync with current batch expiry state. */
  async syncNotifications(businessId: string, asOf = new Date()): Promise<void> {
    await this.refreshExpiryNotifications(businessId, asOf);
  },

  /** Update existing expiry notifications only — never creates or marks unread. */
  async refreshExpiryNotifications(
    businessId: string,
    asOf = new Date()
  ): Promise<void> {
    const alerts = await this.listAlerts(businessId, asOf);
    const activeKeys: string[] = [];

    for (const batch of alerts) {
      const payload = buildBatchAlertNotification(batch);
      activeKeys.push(payload.dedupeKey);
      await notificationRepository.updateExpiryAlertContent(
        businessId,
        payload.dedupeKey,
        payload
      );
    }

    await notificationRepository.deleteExpiryAlertsNotIn(businessId, activeKeys);
  },

  /** Create missing expiry notifications (e.g. after receive stock or cron). */
  async ensureExpiryNotifications(
    businessId: string,
    asOf = new Date()
  ): Promise<void> {
    const alerts = await this.listAlerts(businessId, asOf);
    const activeKeys: string[] = [];

    for (const batch of alerts) {
      const payload = buildBatchAlertNotification(batch);
      activeKeys.push(payload.dedupeKey);
      const existing = await notificationRepository.findByDedupeKey(
        businessId,
        payload.dedupeKey
      );
      if (existing) {
        await notificationRepository.updateExpiryAlertContent(
          businessId,
          payload.dedupeKey,
          payload
        );
      } else {
        await notificationService.create(payload);
      }
    }

    await notificationRepository.deleteExpiryAlertsNotIn(businessId, activeKeys);
  },

  /** Scan batches and raise in-app + email alerts (daily cron). */
  async runExpiryAlerts(asOf = new Date()): Promise<ExpiryRunResult> {
    const result: ExpiryRunResult = {
      processed: 0,
      sent: 0,
      skipped: 0,
      warnings: 0,
      critical: 0,
      errors: [],
    };

    const today = calendarDayRange(0, asOf);
    const batches = await batchRepository.findActiveWithExpiry();
    const alerts = await enrichBatches(batches, asOf);

    for (const batch of alerts) {
      result.processed++;
      if (batch.level === "warning") result.warnings++;
      else result.critical++;

      const kind = reminderKindForLevel(batch.level);
      const claimed = await reminderDispatchRepository.tryClaim({
        businessId: batch.businessId,
        kind,
        referenceType: "batch",
        referenceId: batch._id,
        anchorDate: today.key,
      });

      if (!claimed) {
        result.skipped++;
        continue;
      }

      try {
        await dispatchBatchAlert(batch);
        result.sent++;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unknown expiry alert error";
        result.errors.push(`EXPIRY:${batch._id}: ${msg}`);
      }
    }

    return result;
  },
};
