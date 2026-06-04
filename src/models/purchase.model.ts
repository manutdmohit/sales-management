import { Schema, model, models } from "mongoose";

const purchaseItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitId: String,
    unitCost: { type: Number, required: true },
    batchNumber: String,
    expiryDate: Date,
    batchId: String,
  },
  { _id: false }
);

const paymentReceiptSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    uploadedAt: Date,
    uploadedBy: String,
    label: String,
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    supplierId: { type: String, index: true },
    supplierName: { type: String, required: true },
    items: { type: [purchaseItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    referenceNumber: String,
    receipts: { type: [paymentReceiptSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "purchases" }
);

purchaseSchema.index({ businessId: 1, createdAt: -1 });
purchaseSchema.index({ businessId: 1, supplierId: 1, createdAt: -1 });

export const PurchaseModel =
  models.Purchase ?? model("Purchase", purchaseSchema);
