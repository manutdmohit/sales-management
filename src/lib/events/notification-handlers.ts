import { calculateStockFromTransactions } from "@/domain/inventory/inventory.engine";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { formatDateTimeYmd, formatDateYmd } from "@/lib/format-datetime";
import { eventBus } from "@/lib/events/event-bus";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productRepository } from "@/repositories/product.repository";
import { notificationService } from "@/services/notification.service";

/** Register handlers that persist in-app notifications from domain events. */
export function registerNotificationHandlers(): void {
  eventBus.on("STOCK_UPDATED", async (event) => {
    const productId = event.payload.productId as string | undefined;
    if (!productId) return;

    const product = await productRepository.findById(productId);
    if (!product || product.businessId !== event.businessId) return;

    const transactions = await inventoryRepository.findByProduct(
      event.businessId,
      productId
    );
    const stock = calculateStockFromTransactions(transactions);
    if (stock > product.minStock) return;

    await notificationService.createOrRefresh({
      businessId: event.businessId,
      type: "LOW_STOCK",
      title: "Low stock alert",
      message: `${product.name} (${product.sku}) has ${formatQuantityWithUnit(stock, product.unitId)} left — limit is ${formatQuantityWithUnit(product.minStock, product.unitId)}.`,
      referenceType: "product",
      referenceId: productId,
      dedupeKey: `LOW_STOCK:${productId}`,
    });
  });

  eventBus.on("CREDIT_SALE_CREATED", async (event) => {
    const invoiceNumber = event.payload.invoiceNumber as string;
    const amountDue = event.payload.amountDue as number;
    const dueDate = event.payload.dueDate as string | Date | undefined;
    const saleId = event.payload.saleId as string;
    const customer = event.payload.customer as
      | { name?: string }
      | undefined;

    const dueLabel = dueDate ? formatDateYmd(dueDate) : "not set";
    const customerLabel = customer?.name ? ` for ${customer.name}` : "";

    await notificationService.create({
      businessId: event.businessId,
      type: "CREDIT_SALE",
      title: "Credit sale recorded",
      message: `${invoiceNumber}${customerLabel} — ${amountDue.toFixed(2)} outstanding, due ${dueLabel}.`,
      referenceType: "sale",
      referenceId: saleId,
    });
  });

  eventBus.on("APPOINTMENT_BOOKED", async (event) => {
    const appointmentId = event.payload.appointmentId as string;
    const startAt = event.payload.startAt as string | Date;
    const serviceName = event.payload.serviceName as string | undefined;
    const customerName = event.payload.customerName as string | undefined;

    const when = formatDateTimeYmd(startAt);
    const who = customerName ? ` for ${customerName}` : "";
    const what = serviceName ?? "Service";

    await notificationService.create({
      businessId: event.businessId,
      type: "APPOINTMENT_BOOKED",
      title: "Appointment booked",
      message: `${what}${who} on ${when}.`,
      referenceType: "appointment",
      referenceId: appointmentId,
    });
  });
}

