"use client";

import { useEffect } from "react";
import { DailyEditor } from "./DailyEditor";
import {
  useDashboard,
  type DashboardData,
} from "@/lib/use-dashboard";
import { useMutations } from "@/lib/swr-mutations";

/**
 * Wraps the Daily editor with the shared SWR cache. `initial` (today's data,
 * fetched server-side) seeds the cache via fallbackData for an instant first
 * paint; SWR then upgrades to the full dataset. On every (re)open of Daily we
 * revalidate — that's the single place the app resyncs with Supabase.
 */
export function DailyClient({
  initial,
  selectedDate,
  todayISO,
}: {
  initial: DashboardData;
  selectedDate: string;
  todayISO: string;
}) {
  const { data, mutate } = useDashboard({ fallbackData: initial });
  const mutations = useMutations();

  useEffect(() => {
    mutate();
  }, [mutate]);

  if (!data) return null;

  return (
    <DailyEditor
      data={data}
      mutations={mutations}
      selectedDate={selectedDate}
      todayISO={todayISO}
    />
  );
}
