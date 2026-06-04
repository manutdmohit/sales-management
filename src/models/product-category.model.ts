import { Schema, model, models } from "mongoose";

const productCategorySchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: String,
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "product_categories" }
);

productCategorySchema.index({ businessId: 1, slug: 1 }, { unique: true });
productCategorySchema.index({ businessId: 1, name: 1 });
productCategorySchema.index({ businessId: 1, isActive: 1, sortOrder: 1 });

export const ProductCategoryModel =
  models.ProductCategory ??
  model("ProductCategory", productCategorySchema);
