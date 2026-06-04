import { Schema, model, models } from "mongoose";
import { BUSINESS_TYPES } from "@/domain/business-types";

const businessSettingsSchema = new Schema(
  {
    currency: String,
    timezone: String,
    invoicePrefix: String,
    logoUrl: String,
    address: String,
  },
  { _id: false }
);

const businessSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: BUSINESS_TYPES,
      default: "GENERAL",
    },
    isActive: { type: Boolean, default: true },
    settings: { type: businessSettingsSchema, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "businesses" }
);

export const BusinessModel =
  models.Business ?? model("Business", businessSchema);
