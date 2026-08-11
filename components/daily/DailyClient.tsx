"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DailyEditor } from "./DailyEditor";
import { useDashboard } from "@/lib/use-dashboard";
import { useMutations } from "@/lib/swr-mutations";
import { toISODate } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Daily is fully client-side: today/date are computed in the browser (native
 * timezone), and it reads from the shared SWR cache (seeded by the layout) — so
 * there's no per-Daily server fetch, no spinner, and no flash. Returning to
 * Daily triggers a background revalidation (the only place the app resyncs).
 */
export function DailyClient() {
  const params = useSearchParams();
  const todayISO = toISODate(new Date());
  const dateParam = params.get("date");
  const selectedDate =
    dateParam && DATE_RE.test(dateParam) ? dateParam : todayISO;

  const { data, mutate } = useDashboard();
  const mutations = useMutations();

  useEffect(() => {
    mutate();
  }, [mutate]);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  return (
    <DailyEditor
      data={data}
      mutations={mutations}
      selectedDate={selectedDate}
      todayISO={todayISO}
    />
  );
}
