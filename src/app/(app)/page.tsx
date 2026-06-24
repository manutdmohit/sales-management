import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BUSINESS_COOKIE, resolveBusinessId } from "@/lib/business-cookie";
import { getSession } from "@/lib/auth/session";
import { connectDb } from "@/lib/db";
import { businessService } from "@/services/business.service";
import { dashboardService } from "@/services/dashboard.service";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await connectDb();
  const cookieStore = await cookies();
  const cookieBusinessId = cookieStore.get(BUSINESS_COOKIE)?.value ?? null;
  const businessesResult = await businessService.list();
  const businesses = Array.isArray(businessesResult)
    ? businessesResult
    : businessesResult.items;
  const businessId = resolveBusinessId(businesses, cookieBusinessId);

  const initialData = businessId
    ? await dashboardService.getDashboard(businessId, "daily")
    : null;

  return (
    <DashboardClient
      initialData={initialData}
      initialBusinessId={businessId}
    />
  );
}
