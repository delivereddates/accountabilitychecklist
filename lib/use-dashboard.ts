"use client";

import useSWR from "swr";
import type { Task, TaskCompletion, User } from "./types";

export const DASHBOARD_KEY = "/api/dashboard";

export interface DashboardData {
  users: User[];
  tasks: Task[];
  completions: TaskCompletion[];
}

async function fetcher(url: string): Promise<DashboardData> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load dashboard data");
  return res.json();
}

/**
 * Shared SWR cache of the full dataset. All summary tabs and the Daily editor
 * read from this single key, so switching tabs is instant after the first load.
 * Revalidation is driven by the SWRConfig in the (app) layout (no focus/reconnect
 * auto-refresh) plus an explicit mutate() when returning to the Daily page.
 */
export function useDashboard(opts?: { fallbackData?: DashboardData }) {
  return useSWR<DashboardData>(DASHBOARD_KEY, fetcher, {
    ...(opts?.fallbackData ? { fallbackData: opts.fallbackData } : null),
  });
}
