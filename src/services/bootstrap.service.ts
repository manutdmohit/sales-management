import type { TablePageSizeOption } from "@/domain/table-settings";
import type { Business } from "@/domain/types";
import { resolveBusinessId } from "@/lib/business-cookie";
import type { SessionUser } from "@/lib/auth/session";
import { appSettingsService } from "./app-settings.service";
import { authService } from "./auth.service";
import { businessService } from "./business.service";

export type BootstrapData = {
  user: {
    _id: string;
    email: string;
    name: string;
    role: string;
  };
  businesses: Business[];
  businessId: string | null;
  tablePageSize: TablePageSizeOption;
};

export const bootstrapService = {
  async getForSession(
    session: SessionUser,
    preferredBusinessId?: string | null
  ): Promise<BootstrapData> {
    const [user, businessesResult, tablePageSize] = await Promise.all([
      authService.getProfile(session.sub),
      businessService.list(),
      appSettingsService.getTablePageSize(),
    ]);

    const businesses = Array.isArray(businessesResult)
      ? businessesResult
      : businessesResult.items;

    return {
      user,
      businesses,
      businessId: resolveBusinessId(businesses, preferredBusinessId),
      tablePageSize: tablePageSize as TablePageSizeOption,
    };
  },
};
