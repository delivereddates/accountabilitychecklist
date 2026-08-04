import { addDays } from "date-fns";
import { DailyEditor } from "@/components/daily/DailyEditor";
import { getDashboardData } from "@/lib/db";
import { fromISODate, toISODate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const todayISO = toISODate(new Date());
  const selectedISO =
    sp.date && DATE_RE.test(sp.date) ? sp.date : todayISO;
  const prevISO = toISODate(addDays(fromISODate(selectedISO), -1));

  // Fetch the contiguous [prev, selected] window so both columns have data.
  const [from, to] =
    prevISO < selectedISO ? [prevISO, selectedISO] : [selectedISO, prevISO];
  const { users, tasks, completions } = await getDashboardData(from, to);

  return (
    <DailyEditor
      key={selectedISO}
      users={users}
      tasks={tasks}
      completions={completions}
      selectedDate={selectedISO}
      prevDate={prevISO}
      todayISO={todayISO}
    />
  );
}
