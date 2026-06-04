import { Schema, model, models } from "mongoose";
import type { CreditStatus, PaymentMethod, SaleType } from "@/domain/types";

const paymentMethods: PaymentMethod[] = ["CASH", "ONLINE"];
const saleTypes: SaleType[] = ["IMMEDIATE", "CREDIT"];
const creditStatuses: CreditStatus[] = ["PENDING", "PARTIAL", "PAID"];

const saleItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    batchId: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    unitCost: Number,
    lineCost: Number,
  },
  { _id: false }
);

const salePaymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: paymentMethods, default: "CASH" },
    at: { type: Date, default: Date.now },
    note: String,
    receipt: {
      type: {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        uploadedAt: Date,
        uploadedBy: String,
        label: String,
      },
      required: false,
      _id: false,
    },
  },
  { _id: false }
);

const saleCustomerSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
  },
  { _id: false }
);

const saleSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true },
    items: { type: [saleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    totalCost: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      required: true,
      enum: paymentMethods,
    },
    saleType: {
      type: String,
      required: true,
      enum: saleTypes,
      default: "IMMEDIATE",
    },
    customer: saleCustomerSchema,
    clientId: { type: String, index: true },
    dueDate: Date,
    amountPaid: { type: Number, required: true, default: 0 },
    amountDue: { type: Number, required: true, default: 0 },
    creditStatus: { type: String, enum: creditStatuses },
    payments: { type: [salePaymentSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "sales" }
);

saleSchema.index({ businessId: 1, createdAt: -1 });
saleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
saleSchema.index({ businessId: 1, "customer.phone": 1 });
// Receivables: outstanding credit sales sorted by due date.
saleSchema.index({ businessId: 1, saleType: 1, creditStatus: 1, dueDate: 1 });

export const SaleModel = models.Sale ?? model("Sale", saleSchema);
