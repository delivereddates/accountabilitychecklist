"use client";

import { useSWRConfig } from "swr";
import { useDashboard, type DashboardData } from "./use-dashboard";
import { buildCompletionIndex, getStatus, tasksActiveOnDate } from "./scoring";
import type { CompletionStatus, Task, TaskCompletion } from "./types";

const EMPTY: DashboardData = { users: [], tasks: [], completions: [] };

// ---------------------------------------------------------------------------
// Mutation coordinator
//
// The frontend cache is the source of truth for the session. Toggles write to
// the cache immediately and queue a debounced save. On 200 OK we do NOTHING
// (never overwrite the cache with the response). We only reconcile (full
// background re-fetch) when a save fails AND the network is idle.
// ---------------------------------------------------------------------------

type PendingWrite =
  | { kind: "status"; taskId: string; date: string; status: CompletionStatus }
  | { kind: "clear"; taskId: string; date: string };

const DEBOUNCE_MS = 500;
const pending = new Map<string, PendingWrite>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = 0;
let needsReconcile = false;
let resyncRequested = false;
// Bound SWR mutate for the dashboard key (set on each useMutations call).
let boundMutate: (() => Promise<unknown>) | null = null;

const keyOf = (taskId: string, date: string) => `${taskId}|${date}`;

function scheduleFlush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}

async function flush() {
  timer = null;
  if (pending.size === 0) {
    maybeReconcile();
    return;
  }
  const batch = Array.from(pending.values());
  pending.clear();
  inFlight++;
  try {
    await Promise.all(
      batch.map(async (w) => {
        if (w.kind === "clear") {
          const res = await fetchRetry(
            `/api/completions?task_id=${encodeURIComponent(w.taskId)}&date=${encodeURIComponent(w.date)}`,
            { method: "DELETE" },
          );
          if (!res.ok) throw new Error("clear failed");
        } else {
          const res = await fetchRetry("/api/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: w.taskId,
              date: w.date,
              status: w.status,
            }),
          });
          if (!res.ok) throw new Error("save failed");
        }
      }),
    );
    // 200 OK → do nothing. Cache is authoritative.
  } catch {
    needsReconcile = true;
  } finally {
    inFlight--;
    maybeReconcile();
  }
}

function maybeReconcile() {
  if (inFlight > 0 || pending.size > 0 || timer) return; // not idle yet
  if (needsReconcile || resyncRequested) {
    needsReconcile = false;
    resyncRequested = false;
    void boundMutate?.(); // full background re-fetch
  }
}

/** Re-fetch once the coordinator is idle (used when returning to Daily). */
export function resyncWhenIdle() {
  resyncRequested = true;
  maybeReconcile(); // if already idle, refetch now; else flush/in-flight will trigger it
}

/**
 * fetch with a few retries on transient (5xx / network) failures. Supabase
 * occasionally returns "JWT issued at future" on clock skew — a quick retry
 * usually clears it. 4xx are returned as-is (not retried).
 */
async function fetchRetry(
  url: string,
  init: RequestInit,
  attempts = 4,
): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status < 500) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error("request failed");
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useMutations() {
  const { mutate } = useDashboard();
  const { cache } = useSWRConfig();
  boundMutate = () => mutate();

  /** Read the latest cache synchronously (so rapid clicks see prior clicks). */
  const latest = (): DashboardData =>
    (cache.get("/api/dashboard")?.data as DashboardData | undefined) ?? EMPTY;

  const applyWrites = (writes: PendingWrite[]) => {
    mutate(
      (prev) => {
        let next = prev;
        for (const w of writes) {
          if (w.kind === "status") {
            next = upsertCompletion(next, {
              id: "tmp",
              task_id: w.taskId,
              date: w.date,
              status: w.status,
            });
          } else {
            next = removeCompletion(next, w.taskId, w.date);
          }
        }
        return next;
      },
      { revalidate: false },
    );
  };

  const setCompletion = (taskId: string, date: string, status: CompletionStatus) => {
    const cur = latest();
    const writes: PendingWrite[] = [
      { kind: "status", taskId, date, status },
    ];
    // Client-side backfill on check: mark this user's other still-unset active
    // tasks as no_check. Computed from the latest cache, so a task you already
    // checked is never overwritten. (Server just stores what we send.)
    if (status === "check") {
      const task = cur.tasks.find((t) => t.id === taskId);
      if (task) {
        const idx = buildCompletionIndex(cur.completions);
        const active = tasksActiveOnDate(
          cur.tasks.filter((t) => t.user_id === task.user_id),
          date,
        );
        for (const s of active) {
          if (s.id !== taskId && getStatus(idx, s.id, date) === undefined) {
            writes.push({ kind: "status", taskId: s.id, date, status: "no_check" });
          }
        }
      }
    }
    applyWrites(writes);
    for (const w of writes) pending.set(keyOf(w.taskId, w.date), w);
    scheduleFlush();
  };

  const clearCompletion = (taskId: string, date: string) => {
    applyWrites([{ kind: "clear", taskId, date }]);
    pending.set(keyOf(taskId, date), { kind: "clear", taskId, date });
    scheduleFlush();
  };

  const addUser = async (name: string) => {
    const res = await fetchRetry("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error("add user failed");
    const { user } = (await res.json()) as { user: DashboardData["users"][number] };
    await mutate(
      (cur) => ({ ...(cur ?? EMPTY), users: [...(cur ?? EMPTY).users, user] }),
      { revalidate: false },
    );
  };

  const addTask = async (userId: string, title: string, notes = "") => {
    const res = await fetchRetry("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title, notes }),
    });
    if (!res.ok) throw new Error("add task failed");
    const { task } = (await res.json()) as { task: Task };
    await mutate(
      (cur) => ({ ...(cur ?? EMPTY), tasks: [...(cur ?? EMPTY).tasks, task] }),
      { revalidate: false },
    );
  };

  const updateTask = (taskId: string, patch: { title?: string; notes?: string }) =>
    mutate(
      async (cur) => {
        const res = await fetchRetry(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("update failed");
        const { task } = (await res.json()) as { task: Task };
        return {
          ...(cur ?? EMPTY),
          tasks: (cur ?? EMPTY).tasks.map((t) => (t.id === taskId ? task : t)),
        };
      },
      {
        optimisticData: (cur) => ({
          ...(cur ?? EMPTY),
          tasks: (cur ?? EMPTY).tasks.map((t) =>
            t.id === taskId ? { ...t, ...patch } : t,
          ),
        }),
        rollbackOnError: true,
        populateCache: false,
        revalidate: false,
      },
    );

  const deleteTask = (taskId: string) =>
    mutate(
      async (cur) => {
        const res = await fetchRetry(`/api/tasks/${taskId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete task failed");
        const base = cur ?? EMPTY;
        return {
          ...base,
          tasks: base.tasks.filter((t) => t.id !== taskId),
          completions: base.completions.filter((c) => c.task_id !== taskId),
        };
      },
      {
        optimisticData: (cur) => {
          const base = cur ?? EMPTY;
          return {
            ...base,
            tasks: base.tasks.filter((t) => t.id !== taskId),
            completions: base.completions.filter((c) => c.task_id !== taskId),
          };
        },
        rollbackOnError: true,
        populateCache: false,
        revalidate: false,
      },
    );

  const deleteUser = (userId: string) =>
    mutate(
      async (cur) => {
        const res = await fetchRetry(`/api/users/${userId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete user failed");
        return pruneUser(cur, userId);
      },
      {
        optimisticData: (cur) => pruneUser(cur, userId),
        rollbackOnError: true,
        populateCache: false,
        revalidate: false,
      },
    );

  return {
    setCompletion,
    clearCompletion,
    addUser,
    addTask,
    updateTask,
    deleteTask,
    deleteUser,
  };
}

// --- pure cache helpers (always return a full DashboardData) ---

function upsertCompletion(
  cur: DashboardData | undefined,
  comp: TaskCompletion,
): DashboardData {
  const base = cur ?? EMPTY;
  const idx = base.completions.findIndex(
    (c) => c.task_id === comp.task_id && c.date === comp.date,
  );
  const completions =
    idx >= 0
      ? base.completions.map((c, i) =>
          i === idx ? { ...c, status: comp.status } : c,
        )
      : [...base.completions, comp];
  return { ...base, completions };
}

function removeCompletion(
  cur: DashboardData | undefined,
  taskId: string,
  date: string,
): DashboardData {
  const base = cur ?? EMPTY;
  return {
    ...base,
    completions: base.completions.filter(
      (c) => !(c.task_id === taskId && c.date === date),
    ),
  };
}

function pruneUser(cur: DashboardData | undefined, userId: string): DashboardData {
  const base = cur ?? EMPTY;
  const taskIds = new Set(
    base.tasks.filter((t) => t.user_id === userId).map((t) => t.id),
  );
  return {
    ...base,
    users: base.users.filter((u) => u.id !== userId),
    tasks: base.tasks.filter((t) => t.user_id !== userId),
    completions: base.completions.filter((c) => !taskIds.has(c.task_id)),
  };
}
