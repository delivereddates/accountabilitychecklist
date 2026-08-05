import { DailyClient } from "@/components/daily/DailyClient";
import { getDashboardData } from "@/lib/db";
import { toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const todayISO = toISODate(new Date());
  const selectedISO = sp.date && DATE_RE.test(sp.date) ? sp.date : todayISO;

  // Seed the SWR cache with the selected day for an instant first paint; SWR
  // then fetches the full dataset (/api/dashboard) in the background.
  const initial = await getDashboardData(selectedISO, selectedISO);

  return (
    <DailyClient
      initial={initial}
      selectedDate={selectedISO}
      todayISO={todayISO}
    />
  );
}
