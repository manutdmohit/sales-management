import { Schema, model, models } from "mongoose";

const clientSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    address: String,
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "clients" }
);

clientSchema.index({ businessId: 1, phone: 1 }, { unique: true });
clientSchema.index({ businessId: 1, name: 1 });

export const ClientModel =
  models.Client ?? model("Client", clientSchema);
