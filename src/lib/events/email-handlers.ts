import { calculateStockFromTransactions } from "@/domain/inventory/inventory.engine";
import { eventBus } from "@/lib/events/event-bus";
import {
  getAdminNotificationEmails,
} from "@/lib/email/recipients";
import { emailTemplates } from "@/lib/email/templates";
import { emailService } from "@/services/email.service";
import { businessRepository } from "@/repositories/business.repository";
import { inventoryRepository } from "@/repositories/inventory.repository";
import { productRepository } from "@/repositories/product.repository";
import { saleRepository } from "@/repositories/sale.repository";
import { appointmentRepository } from "@/repositories/appointment.repository";

async function businessName(businessId: string): Promise<string> {
  const business = await businessRepository.findById(businessId);
  return business?.name ?? "Your business";
}

async function notifyAdmins(
  subject: string,
  html: string,
  text?: string
): Promise<void> {
  const recipients = await getAdminNotificationEmails();
  if (recipients.length === 0) return;
  await emailService.sendSafe({ to: recipients, subject, html, text });
}

/** Register handlers that email admins and customers on domain events. */
export function registerEmailHandlers(): void {
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

    const name = await businessName(event.businessId);
    const tpl = emailTemplates.lowStock({
      businessName: name,
      productName: product.name,
      sku: product.sku,
      stock,
      minStock: product.minStock,
      unitId: product.unitId,
    });
    await notifyAdmins(tpl.subject, tpl.html, tpl.text);
  });

  eventBus.on("CREDIT_SALE_CREATED", async (event) => {
    const invoiceNumber = event.payload.invoiceNumber as string;
    const amountDue = event.payload.amountDue as number;
    const total = event.payload.total as number | undefined;
    const amountPaid = event.payload.amountPaid as number | undefined;
    const dueDate = event.payload.dueDate as string | Date | undefined;
    const customer = event.payload.customer as
      | { name?: string; email?: string }
      | undefined;

    const name = await businessName(event.businessId);

    const adminTpl = emailTemplates.creditSaleAdmin({
      businessName: name,
      invoiceNumber,
      customerName: customer?.name,
      amountDue,
      dueDate,
    });
    await notifyAdmins(adminTpl.subject, adminTpl.html, adminTpl.text);

    if (customer?.email?.trim()) {
      const customerTpl = emailTemplates.creditSaleCustomer({
        businessName: name,
        invoiceNumber,
        customerName: customer.name ?? "Customer",
        total: total ?? amountDue + (amountPaid ?? 0),
        amountPaid: amountPaid ?? 0,
        amountDue,
        dueDate,
      });
      await emailService.sendSafe({
        to: customer.email.trim(),
        ...customerTpl,
      });
    }
  });

  eventBus.on("SALE_CREATED", async (event) => {
    const saleType = event.payload.saleType as string | undefined;
    if (saleType === "CREDIT") return;

    const customer = event.payload.customer as
      | { name?: string; email?: string }
      | undefined;
    if (!customer?.email?.trim()) return;

    const invoiceNumber = event.payload.invoiceNumber as string;
    const total = event.payload.total as number;
    const paymentMethod = (event.payload.paymentMethod as string) ?? "CASH";
    const items = (event.payload.items as string) ?? "";

    const name = await businessName(event.businessId);
    const tpl = emailTemplates.saleReceipt({
      businessName: name,
      invoiceNumber,
      customerName: customer.name ?? "Customer",
      total,
      paymentMethod,
      lines: items,
    });
    await emailService.sendSafe({
      to: customer.email.trim(),
      ...tpl,
    });
  });

  eventBus.on("PAYMENT_RECORDED", async (event) => {
    const saleId = event.payload.saleId as string | undefined;
    const appointmentId = event.payload.appointmentId as string | undefined;
    const amount = event.payload.amount as number;
    const amountDue = event.payload.amountDue as number;
    const method = (event.payload.method as string) ?? "CASH";

    const name = await businessName(event.businessId);

    if (saleId) {
      const sale = await saleRepository.findById(saleId);
      if (!sale?.customer?.email?.trim()) return;
      const tpl = emailTemplates.paymentReceived({
        businessName: name,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customer.name ?? "Customer",
        amount,
        amountDue,
        method,
      });
      await emailService.sendSafe({
        to: sale.customer.email.trim(),
        ...tpl,
      });
      return;
    }

    if (appointmentId) {
      const appointment = await appointmentRepository.findById(appointmentId);
      const email = appointment?.customerEmail?.trim();
      if (!appointment || !email) return;
      const tpl = emailTemplates.paymentReceived({
        businessName: name,
        invoiceNumber: appointment.serviceName,
        customerName: appointment.customerName,
        amount,
        amountDue,
        method,
      });
      await emailService.sendSafe({ to: email, ...tpl });
    }
  });

  eventBus.on("APPOINTMENT_BOOKED", async (event) => {
    const serviceName = (event.payload.serviceName as string) ?? "Service";
    const customerName = (event.payload.customerName as string) ?? "Customer";
    const customerPhone = (event.payload.customerPhone as string) ?? "";
    const customerEmail = event.payload.customerEmail as string | undefined;
    const startAt = event.payload.startAt as string | Date;
    const endAt = event.payload.endAt as string | Date;
    const price = event.payload.price as number | undefined;
    const amountDue = event.payload.amountDue as number | undefined;
    const dueDate = event.payload.dueDate as string | Date | undefined;

    const name = await businessName(event.businessId);

    const adminTpl = emailTemplates.appointmentAdmin({
      businessName: name,
      serviceName,
      customerName,
      customerPhone,
      startAt,
      endAt,
    });
    await notifyAdmins(adminTpl.subject, adminTpl.html, adminTpl.text);

    if (customerEmail?.trim()) {
      const customerTpl = emailTemplates.appointmentCustomer({
        businessName: name,
        customerName,
        serviceName,
        startAt,
        endAt,
        price: price ?? 0,
        amountDue,
        dueDate,
      });
      await emailService.sendSafe({
        to: customerEmail.trim(),
        ...customerTpl,
      });
    }
  });

  eventBus.on("PURCHASE_CREATED", async (event) => {
    const supplierName = (event.payload.supplierName as string) ?? "Supplier";
    const total = event.payload.total as number;
    const itemCount = (event.payload.itemCount as number) ?? 0;

    const name = await businessName(event.businessId);
    const tpl = emailTemplates.purchaseAdmin({
      businessName: name,
      supplierName,
      total,
      itemCount,
    });
    await notifyAdmins(tpl.subject, tpl.html, tpl.text);
  });
}
