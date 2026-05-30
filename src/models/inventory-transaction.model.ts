import { Schema, model, models } from "mongoose";
import type { InventoryTransactionType } from "@/domain/types";

const inventoryTransactionTypes: InventoryTransactionType[] = [
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "DAMAGE",
  "RETURN",
  "EXPIRED",
];

const inventoryTransactionSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    batchId: String,
    type: {
      type: String,
      required: true,
      enum: inventoryTransactionTypes,
    },
    quantity: { type: Number, required: true },
    referenceId: String,
    notes: String,
    timestamp: { type: Date, required: true, default: Date.now },
  },
  { collection: "inventory_transactions" }
);

inventoryTransactionSchema.index({
  businessId: 1,
  productId: 1,
  timestamp: -1,
});
inventoryTransactionSchema.index({ businessId: 1, batchId: 1 });
inventoryTransactionSchema.index({ referenceId: 1 });

export const InventoryTransactionModel =
  models.InventoryTransaction ??
  model("InventoryTransaction", inventoryTransactionSchema);
