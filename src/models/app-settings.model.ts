import { Schema, model, models } from "mongoose";
import { DEFAULT_TABLE_PAGE_SIZE } from "@/domain/table-settings";

const appSettingsSchema = new Schema(
  {
    _id: { type: String, default: "platform" },
    defaultTablePageSize: {
      type: Number,
      default: DEFAULT_TABLE_PAGE_SIZE,
    },
  },
  { collection: "app_settings" }
);

export const AppSettingsModel =
  models.AppSettings ?? model("AppSettings", appSettingsSchema);
