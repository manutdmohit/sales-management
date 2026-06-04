import {
  clampTablePageSize,
  DEFAULT_TABLE_PAGE_SIZE,
} from "@/domain/table-settings";
import { appSettingsRepository } from "@/repositories/app-settings.repository";

export const appSettingsService = {
  async getTablePageSize(): Promise<number> {
    const settings = await appSettingsRepository.get();
    return clampTablePageSize(
      settings.defaultTablePageSize ?? DEFAULT_TABLE_PAGE_SIZE
    );
  },

  async updateTablePageSize(size: number) {
    const defaultTablePageSize = clampTablePageSize(size);
    return appSettingsRepository.upsert({ defaultTablePageSize });
  },
};
