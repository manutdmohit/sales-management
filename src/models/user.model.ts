import { Schema, model, models } from "mongoose";
import type { UserRole } from "@/domain/roles";

const userRoles: UserRole[] = ["ADMIN", "STAFF"];

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true, enum: userRoles, default: "ADMIN" },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "users" }
);

export const UserModel = models.User ?? model("User", userSchema);
