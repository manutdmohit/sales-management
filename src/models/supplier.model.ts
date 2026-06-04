import { Schema, model, models } from "mongoose";

const supplierSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: String,
    phone: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    address: String,
    notes: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "suppliers" }
);

supplierSchema.index({ businessId: 1, name: 1 }, { unique: true });
supplierSchema.index({ businessId: 1, isActive: 1 });

export const SupplierModel =
  models.Supplier ?? model("Supplier", supplierSchema);
