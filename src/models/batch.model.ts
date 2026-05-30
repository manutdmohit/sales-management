import { Schema, model, models } from "mongoose";

const batchSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    batchNumber: { type: String, required: true },
    expiryDate: Date,
    quantity: { type: Number, required: true },
    remainingQuantity: { type: Number, required: true },
    purchaseId: String,
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "batches" }
);

batchSchema.index({ businessId: 1, productId: 1 });
batchSchema.index({ expiryDate: 1 });

export const BatchModel = models.Batch ?? model("Batch", batchSchema);
