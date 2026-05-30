import { Schema, model, models } from "mongoose";
import { BUSINESS_TYPES } from "@/domain/business-types";

const productPricingSchema = new Schema(
  {
    purchase: { type: Number, required: true },
    selling: { type: Number, required: true },
  },
  { _id: false }
);

const productSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    businessType: {
      type: String,
      required: true,
      enum: BUSINESS_TYPES,
      index: true,
    },
    categoryId: String,
    name: { type: String, required: true },
    slug: { type: String, required: true },
    sku: { type: String, required: true },
    unitId: String,
    pricing: { type: productPricingSchema, required: true },
    trackExpiry: { type: Boolean, default: false },
    minStock: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "products" }
);

productSchema.index({ businessId: 1, sku: 1 }, { unique: true });
productSchema.index({ businessId: 1, isActive: 1 });
productSchema.index({ businessId: 1, name: "text", sku: "text" });

export const ProductModel =
  models.Product ?? model("Product", productSchema);
