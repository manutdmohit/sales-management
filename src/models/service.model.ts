import { Schema, model, models } from "mongoose";

const serviceSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: String,
    price: { type: Number, required: true, default: 0 },
    durationMinutes: Number,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "services" }
);

serviceSchema.index({ businessId: 1, isActive: 1 });
serviceSchema.index({ businessId: 1, name: 1 });

export const ServiceModel =
  models.Service ?? model("Service", serviceSchema);
