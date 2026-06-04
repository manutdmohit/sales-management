import { DEFAULT_TABLE_PAGE_SIZE } from "@/domain/table-settings";
import { AppSettingsModel } from "@/models/app-settings.model";

export type AppSettings = {
  defaultTablePageSize: number;
};

export const appSettingsRepository = {
  async get(): Promise<AppSettings> {
    const doc = await AppSettingsModel.findById("platform").lean();
    if (!doc) {
      return { defaultTablePageSize: DEFAULT_TABLE_PAGE_SIZE };
    }
    return {
      defaultTablePageSize:
        doc.defaultTablePageSize ?? DEFAULT_TABLE_PAGE_SIZE,
    };
  },

  async upsert(
    data: Partial<AppSettings>
  ): Promise<AppSettings> {
    const doc = await AppSettingsModel.findByIdAndUpdate(
      "platform",
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      defaultTablePageSize:
        doc?.defaultTablePageSize ?? DEFAULT_TABLE_PAGE_SIZE,
    };
  },
};
