import { Suspense } from "react";
import { DailyClient } from "@/components/daily/DailyClient";

/**
 * Statically prerendered like the other tabs: DailyClient resolves the user
 * client-side and reads the shared SWR dashboard cache (seeded by the
 * layout's DataLoader), so the navbar's D link fully prefetches the page —
 * tapping in is instant with no server round trip.
 */
export default function DailyPage() {
  return (
    <Suspense fallback={null}>
      <DailyClient />
    </Suspense>
  );
}
