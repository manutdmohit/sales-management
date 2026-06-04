import { formatCalendarDate } from "@/lib/reminder-dates";
import { formatQuantityWithUnit } from "@/lib/format-quantity";
import { formatAppointmentSlot } from "@/lib/format-datetime";

type LayoutOptions = {
  title: string;
  body: string;
  footer?: string;
};

function layout({ title, body, footer }: LayoutOptions): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; line-height: 1.5; color: #0f172a;">
      <h2 style="margin: 0 0 16px; color: #2563eb; font-size: 20px;">${title}</h2>
      ${body}
      ${
        footer
          ? `<p style="margin-top: 24px; font-size: 13px; color: #64748b;">${footer}</p>`
          : ""
      }
    </div>
  `.trim();
}

function money(n: number): string {
  return n.toFixed(2);
}

function appointmentWhen(
  startAt: string | Date,
  endAt: string | Date
): string {
  const { date, timeRange } = formatAppointmentSlot(startAt, endAt);
  return `${date} ${timeRange}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

export const emailTemplates = {
  lowStock(input: {
    businessName: string;
    productName: string;
    sku: string;
    stock: number;
    minStock: number;
    unitId?: string;
  }) {
    const subject = `Low stock: ${input.productName}`;
    const html = layout({
      title: "Low stock alert",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p><strong>${input.productName}</strong> (${input.sku}) has <strong>${formatQuantityWithUnit(input.stock, input.unitId)}</strong> left — minimum is ${formatQuantityWithUnit(input.minStock, input.unitId)}.</p>
      `,
    });
    return { subject, html, text: subject };
  },

  expiryWarning(input: {
    businessName: string;
    productName: string;
    sku: string;
    batchNumber: string;
    remainingQuantity: number;
    unitId?: string;
    expiryDate: Date;
    loginUrl: string;
  }) {
    const subject = `Expiring soon: ${input.productName} (${input.batchNumber})`;
    const html = layout({
      title: "Batch expiring soon",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p><strong>${input.productName}</strong> (${input.sku}) — batch <strong>${escapeHtml(input.batchNumber)}</strong> expires <strong>${formatCalendarDate(input.expiryDate)}</strong>.</p>
        <p>${formatQuantityWithUnit(input.remainingQuantity, input.unitId)} still on hand.</p>
        <p><a href="${escapeHtml(input.loginUrl)}">Review inventory</a></p>
      `,
    });
    return { subject, html, text: subject };
  },

  expiryCritical(input: {
    businessName: string;
    productName: string;
    sku: string;
    batchNumber: string;
    remainingQuantity: number;
    unitId?: string;
    expiryDate: Date;
    loginUrl: string;
  }) {
    const subject = `Expired batch: ${input.productName} (${input.batchNumber})`;
    const html = layout({
      title: "Batch expired",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p><strong>${input.productName}</strong> (${input.sku}) — batch <strong>${escapeHtml(input.batchNumber)}</strong> expired on <strong>${formatCalendarDate(input.expiryDate)}</strong>.</p>
        <p>${formatQuantityWithUnit(input.remainingQuantity, input.unitId)} still on hand — remove or write off stock.</p>
        <p><a href="${escapeHtml(input.loginUrl)}">Review inventory</a></p>
      `,
    });
    return { subject, html, text: subject };
  },

  creditSaleAdmin(input: {
    businessName: string;
    invoiceNumber: string;
    customerName?: string;
    amountDue: number;
    dueDate?: string | Date;
  }) {
    const who = input.customerName ? ` for ${input.customerName}` : "";
    const due = input.dueDate ? formatCalendarDate(input.dueDate) : "not set";
    const subject = `Credit sale ${input.invoiceNumber}`;
    const html = layout({
      title: "Credit sale recorded",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p>Invoice <strong>${input.invoiceNumber}</strong>${who} — outstanding <strong>${money(input.amountDue)}</strong>, due ${due}.</p>
      `,
    });
    return { subject, html, text: subject };
  },

  creditSaleCustomer(input: {
    businessName: string;
    invoiceNumber: string;
    customerName: string;
    total: number;
    amountPaid: number;
    amountDue: number;
    dueDate?: string | Date;
  }) {
    const due = input.dueDate ? formatCalendarDate(input.dueDate) : "as agreed";
    const subject = `Your invoice ${input.invoiceNumber} — ${input.businessName}`;
    const html = layout({
      title: `Hello ${input.customerName}`,
      body: `
        <p>Thank you for your purchase at <strong>${input.businessName}</strong>.</p>
        <p>Invoice: <strong>${input.invoiceNumber}</strong><br/>
        Total: <strong>${money(input.total)}</strong><br/>
        Paid now: <strong>${money(input.amountPaid)}</strong><br/>
        Balance due: <strong>${money(input.amountDue)}</strong><br/>
        Due date: <strong>${due}</strong></p>
      `,
      footer: "Please contact us if you have questions about this invoice.",
    });
    return { subject, html, text: subject };
  },

  saleReceipt(input: {
    businessName: string;
    invoiceNumber: string;
    customerName: string;
    total: number;
    paymentMethod: string;
    lines: string;
  }) {
    const subject = `Receipt ${input.invoiceNumber} — ${input.businessName}`;
    const html = layout({
      title: `Thank you, ${input.customerName}`,
      body: `
        <p>Your purchase at <strong>${input.businessName}</strong> is complete.</p>
        <p>Invoice: <strong>${input.invoiceNumber}</strong><br/>
        Total: <strong>${money(input.total)}</strong><br/>
        Payment: <strong>${input.paymentMethod}</strong></p>
        <pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:13px;white-space:pre-wrap;">${input.lines}</pre>
      `,
    });
    return { subject, html, text: subject };
  },

  paymentReceived(input: {
    businessName: string;
    invoiceNumber: string;
    customerName: string;
    amount: number;
    amountDue: number;
    method: string;
  }) {
    const subject = `Payment received — ${input.invoiceNumber}`;
    const html = layout({
      title: `Hello ${input.customerName}`,
      body: `
        <p>We received your payment of <strong>${money(input.amount)}</strong> (${input.method}) for invoice <strong>${input.invoiceNumber}</strong>.</p>
        <p>Remaining balance: <strong>${money(input.amountDue)}</strong></p>
      `,
      footer: input.businessName,
    });
    return { subject, html, text: subject };
  },

  appointmentAdmin(input: {
    businessName: string;
    serviceName: string;
    customerName: string;
    customerPhone: string;
    startAt: string | Date;
    endAt: string | Date;
  }) {
    const subject = `Appointment booked — ${input.customerName}`;
    const html = layout({
      title: "New appointment",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p><strong>${input.serviceName}</strong> for ${input.customerName} (${input.customerPhone})</p>
        <p>${appointmentWhen(input.startAt, input.endAt)}</p>
      `,
    });
    return { subject, html, text: subject };
  },

  appointmentCustomer(input: {
    businessName: string;
    customerName: string;
    serviceName: string;
    startAt: string | Date;
    endAt: string | Date;
    price: number;
    amountDue?: number;
    dueDate?: string | Date;
  }) {
    const subject = `Appointment confirmed — ${input.businessName}`;
    const credit =
      input.amountDue != null && input.amountDue > 0
        ? `<p>Balance due: <strong>${money(input.amountDue)}</strong>${
            input.dueDate
              ? ` by ${formatCalendarDate(input.dueDate)}`
              : ""
          }</p>`
        : `<p>Paid in full: <strong>${money(input.price)}</strong></p>`;
    const html = layout({
      title: `Hi ${input.customerName}`,
      body: `
        <p>Your appointment at <strong>${input.businessName}</strong> is confirmed.</p>
        <p><strong>${input.serviceName}</strong><br/>
        ${appointmentWhen(input.startAt, input.endAt)}</p>
        ${credit}
      `,
      footer: "Contact us to reschedule if needed.",
    });
    return { subject, html, text: subject };
  },

  purchaseAdmin(input: {
    businessName: string;
    supplierName: string;
    total: number;
    itemCount: number;
  }) {
    const subject = `Stock received from ${input.supplierName}`;
    const html = layout({
      title: "Purchase recorded",
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p>Supplier: <strong>${input.supplierName}</strong><br/>
        Items: ${input.itemCount}<br/>
        Total: <strong>${money(input.total)}</strong></p>
      `,
    });
    return { subject, html, text: subject };
  },

  teamWelcome(input: {
    name: string;
    email: string;
    role: string;
    loginUrl: string;
  }) {
    const subject = "Your Inventory Platform account";
    const html = layout({
      title: `Welcome, ${input.name}`,
      body: `
        <p>An admin created your account on <strong>Inventory Platform</strong>.</p>
        <p>Email: <strong>${input.email}</strong><br/>
        Role: <strong>${input.role}</strong></p>
        <p>Sign in at <a href="${input.loginUrl}">${input.loginUrl}</a> with the password provided by your administrator.</p>
      `,
      footer: "If you did not expect this email, contact your administrator.",
    });
    return { subject, html, text: subject };
  },

  clientMessage(input: {
    businessName: string;
    clientName: string;
    message: string;
    senderName: string;
  }) {
    const subject = `Message from ${input.businessName}`;
    const html = layout({
      title: `Hello ${escapeHtml(input.clientName)}`,
      body: `<div style="white-space: pre-wrap;">${escapeHtml(input.message)}</div>`,
      footer: `Sent by ${escapeHtml(input.senderName)} · ${escapeHtml(input.businessName)}`,
    });
    const text = `Hello ${input.clientName}\n\n${input.message}\n\n— ${input.senderName}, ${input.businessName}`;
    return { subject, html, text };
  },

  creditDueReminderAdmin(input: {
    businessName: string;
    timing: "before" | "on";
    source: "sale" | "appointment";
    label: string;
    customerName: string;
    amountDue: number;
    dueDate: string | Date;
    loginUrl: string;
  }) {
    const when =
      input.timing === "before" ? "due tomorrow" : "due today";
    const kind = input.source === "sale" ? "Invoice" : "Booking";
    const subject = `Credit ${when} — ${input.label}`;
    const html = layout({
      title: `Credit payment ${when}`,
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p>${kind} <strong>${input.label}</strong> for ${input.customerName} is ${when}.</p>
        <p>Outstanding: <strong>${money(input.amountDue)}</strong><br/>
        Due date: <strong>${formatCalendarDate(input.dueDate)}</strong></p>
        <p><a href="${input.loginUrl}">View receivables</a></p>
      `,
    });
    return { subject, html, text: subject };
  },

  creditDueReminderCustomer(input: {
    businessName: string;
    timing: "before" | "on";
    customerName: string;
    label: string;
    amountDue: number;
    dueDate: string | Date;
  }) {
    const when =
      input.timing === "before"
        ? "is due tomorrow"
        : "is due today";
    const subject =
      input.timing === "before"
        ? `Payment reminder — ${input.businessName}`
        : `Payment due today — ${input.businessName}`;
    const html = layout({
      title: `Hello ${input.customerName}`,
      body: `
        <p>This is a friendly reminder from <strong>${input.businessName}</strong>.</p>
        <p>Your balance of <strong>${money(input.amountDue)}</strong> for <strong>${input.label}</strong> ${when} (${formatCalendarDate(input.dueDate)}).</p>
      `,
      footer: "Please contact us if you have already paid or need to arrange payment.",
    });
    return { subject, html, text: subject };
  },

  followUpReminderAdmin(input: {
    businessName: string;
    timing: "before" | "on";
    serviceName: string;
    customerName: string;
    customerPhone: string;
    followUpAt: string | Date;
    loginUrl: string;
  }) {
    const when =
      input.timing === "before" ? "tomorrow" : "today";
    const subject = `Follow-up ${when} — ${input.customerName}`;
    const html = layout({
      title: `Service follow-up ${when}`,
      body: `
        <p><strong>${input.businessName}</strong></p>
        <p>Follow-up for <strong>${input.serviceName}</strong> with ${input.customerName} (${input.customerPhone}) is scheduled for <strong>${formatCalendarDate(input.followUpAt)}</strong>.</p>
        <p><a href="${input.loginUrl}">View appointments</a></p>
      `,
    });
    return { subject, html, text: subject };
  },

  followUpReminderCustomer(input: {
    businessName: string;
    timing: "before" | "on";
    customerName: string;
    serviceName: string;
    followUpAt: string | Date;
  }) {
    const when =
      input.timing === "before"
        ? "is scheduled for tomorrow"
        : "is today";
    const subject =
      input.timing === "before"
        ? `Follow-up reminder — ${input.businessName}`
        : `Follow-up today — ${input.businessName}`;
    const html = layout({
      title: `Hi ${input.customerName}`,
      body: `
        <p>Your follow-up for <strong>${input.serviceName}</strong> at <strong>${input.businessName}</strong> ${when} (${formatCalendarDate(input.followUpAt)}).</p>
      `,
      footer: "Contact us to reschedule if needed.",
    });
    return { subject, html, text: subject };
  },
};
