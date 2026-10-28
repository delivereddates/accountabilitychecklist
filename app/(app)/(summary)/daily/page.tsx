import { Suspense } from "react";
import { DailyClient } from "@/components/daily/DailyClient";
import { currentUserId } from "@/lib/auth-server";
import { getDashboardAll } from "@/lib/db";

/**
 * The dashboard dataset is fetched here, during SSR, and seeds the SWR cache
 * (fallbackData) — first paint already has the checklist, no client fetch
 * waterfall. DataLoader still revalidates in the background once hydrated.
 */
export default async function DailyPage() {
  const [userId, data] = await Promise.all([
    currentUserId(),
    getDashboardAll(),
  ]);
  return (
    <Suspense fallback={null}>
      <DailyClient currentUserId={userId ?? ""} initialData={data} />
    </Suspense>
  );
}
