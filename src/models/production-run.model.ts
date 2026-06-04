import { Schema, model, models } from "mongoose";

const recipeLineSchema = new Schema(
  {
    rawProductId: { type: String, required: true },
    rawProductName: String,
    rawUnitId: String,
    quantityPerUnit: { type: Number, required: true },
  },
  { _id: false }
);

const materialLineSchema = new Schema(
  {
    rawProductId: { type: String, required: true },
    rawProductName: String,
    rawUnitId: String,
    quantityConsumed: { type: Number, required: true },
    unitCost: { type: Number, required: true },
    lineCost: { type: Number, required: true },
  },
  { _id: false }
);

const productionRunSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    finishedProductId: { type: String, required: true, index: true },
    finishedProductName: { type: String, required: true },
    finishedUnitId: String,
    quantityProduced: { type: Number, required: true },
    recipeSnapshot: { type: [recipeLineSchema], required: true },
    materialsSnapshot: { type: [materialLineSchema], default: [] },
    totalMaterialCost: { type: Number, default: 0 },
    unitMaterialCost: { type: Number, default: 0 },
    notes: String,
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "production_runs" }
);

productionRunSchema.index({ businessId: 1, createdAt: -1 });

export const ProductionRunModel =
  models.ProductionRun ?? model("ProductionRun", productionRunSchema);
