"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DailyEditor } from "./DailyEditor";
import { useDashboard } from "@/lib/use-dashboard";
import { useMutations, resyncWhenIdle } from "@/lib/swr-mutations";
import { toISODate } from "@/lib/utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Daily is fully client-side: today/date are computed in the browser (native
 * timezone), and it reads from the shared SWR cache (seeded by the layout) — so
 * there's no per-Daily server fetch, no spinner, and no flash. Returning to
 * Daily asks the coordinator to re-fetch once it's idle (never clobbering
 * in-flight writes).
 */
export function DailyClient() {
  const params = useSearchParams();
  const todayISO = toISODate(new Date());
  const dateParam = params.get("date");
  const selectedDate =
    dateParam && DATE_RE.test(dateParam) ? dateParam : todayISO;

  const { data } = useDashboard();
  const mutations = useMutations();

  useEffect(() => {
    resyncWhenIdle();
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[var(--muted)]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <DailyEditor
      data={data}
      mutations={mutations}
      selectedDate={selectedDate}
    />
  );
}
