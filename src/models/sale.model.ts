import { Schema, model, models } from "mongoose";
import type { PaymentMethod } from "@/domain/types";

const paymentMethods: PaymentMethod[] = ["CASH", "CARD", "UPI", "OTHER"];

const saleItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    batchId: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
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
    paymentMethod: {
      type: String,
      required: true,
      enum: paymentMethods,
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "sales" }
);

saleSchema.index({ businessId: 1, createdAt: -1 });
saleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });

export const SaleModel = models.Sale ?? model("Sale", saleSchema);
