import { Schema, model, models } from "mongoose";
import type {
  AppointmentStatus,
  CreditStatus,
  PaymentMethod,
  SaleType,
} from "@/domain/types";

const appointmentStatuses: AppointmentStatus[] = [
  "BOOKED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];
const paymentMethods: PaymentMethod[] = ["CASH", "ONLINE"];
const saleTypes: SaleType[] = ["IMMEDIATE", "CREDIT"];
const creditStatuses: CreditStatus[] = ["PENDING", "PARTIAL", "PAID"];

const appointmentPaymentSchema = new Schema(
  {
    amount: { type: Number, required: true },
    method: { type: String, enum: paymentMethods, default: "CASH" },
    at: { type: Date, default: Date.now },
    note: String,
    receipt: {
      type: {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        uploadedAt: Date,
        uploadedBy: String,
        label: String,
      },
      required: false,
      _id: false,
    },
  },
  { _id: false }
);

const appointmentSchema = new Schema(
  {
    businessId: { type: String, required: true, index: true },
    serviceId: { type: String, required: true },
    serviceName: { type: String, required: true },
    clientId: { type: String, index: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: String,
    price: { type: Number, required: true, default: 0 },
    saleType: { type: String, enum: saleTypes, default: "IMMEDIATE" },
    paymentMethod: { type: String, enum: paymentMethods, default: "CASH" },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    creditStatus: { type: String, enum: creditStatuses },
    dueDate: Date,
    paymentReceipt: {
      type: {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        uploadedAt: Date,
        uploadedBy: String,
        label: String,
      },
      required: false,
      _id: false,
    },
    payments: { type: [appointmentPaymentSchema], default: [] },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    followUpAt: Date,
    status: {
      type: String,
      required: true,
      enum: appointmentStatuses,
      default: "BOOKED",
    },
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "appointments" }
);

appointmentSchema.index({ businessId: 1, startAt: -1 });
appointmentSchema.index({ businessId: 1, status: 1, startAt: 1, endAt: 1 });
appointmentSchema.index({ businessId: 1, followUpAt: 1 });
appointmentSchema.index({
  businessId: 1,
  saleType: 1,
  creditStatus: 1,
  dueDate: 1,
});

export const AppointmentModel =
  models.Appointment ?? model("Appointment", appointmentSchema);
