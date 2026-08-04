import { YearHeatmap } from "@/components/summary/YearHeatmap";
import { getDashboardData } from "@/lib/db";
import { yearDays, type WindowMode } from "@/lib/dates";
import { toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isMode(s?: string): s is WindowMode {
  return s === "rolling" || s === "calendar";
}

export default async function YearPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const anchor =
    sp.date && DATE_RE.test(sp.date) ? sp.date : toISODate(new Date());
  const mode = isMode(sp.mode) ? sp.mode : "calendar";

  const days = yearDays(anchor, mode);
  const data = await getDashboardData(days[0], days[days.length - 1]);

  return (
    <YearHeatmap
      users={data.users}
      tasks={data.tasks}
      completions={data.completions}
      days={days}
      anchorISO={anchor}
      mode={mode}
    />
  );
}
