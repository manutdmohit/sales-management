import { Schema, model, models } from "mongoose";

const purchaseItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    batchNumber: String,
    expiryDate: Date,
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    supplierName: { type: String, required: true },
    items: { type: [purchaseItemSchema], required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    referenceNumber: String,
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "purchases" }
);

purchaseSchema.index({ businessId: 1, createdAt: -1 });

export const PurchaseModel =
  models.Purchase ?? model("Purchase", purchaseSchema);
