"use client";

import {
  DASHBOARD_KEY,
  fetchDashboard,
  useDashboard,
  type DashboardData,
} from "./use-dashboard";
import type { CompletionStatus, Task, TaskCompletion, TaskNote } from "./types";

const EMPTY: DashboardData = {
  users: [],
  tasks: [],
  completions: [],
  notes: [],
};

// ---------------------------------------------------------------------------
// Mutation coordinator
//
// The frontend cache is the source of truth for the session. Toggles write to
// the cache immediately and queue a debounced save; a write is only confirmed
// by its 200 OK, and unconfirmed writes stay queued and retry with backoff —
// a network dip must never visibly undo a tap. Any re-fetch overlays the
// still-pending writes on the fresh snapshot, so a dashboard response that
// left the server before a tap cannot land on top of it and clobber it.
// ---------------------------------------------------------------------------

type PendingWrite =
  | { kind: "status"; taskId: string; date: string; status: CompletionStatus }
  | { kind: "clear"; taskId: string; date: string };

const DEBOUNCE_MS = 500;
const pending = new Map<string, PendingWrite>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = 0;
let resyncRequested = false;
// Grows after a failed flush batch (server/network down) so retries back off
// instead of hot-looping; reset on the first success.
let retryBackoff = 0;
// Bound SWR mutate for the dashboard key (set on each useMutations call).
let boundMutate: (() => Promise<unknown>) | null = null;

const keyOf = (taskId: string, date: string) => `${taskId}|${date}`;

function scheduleFlush() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS + retryBackoff);
}

async function flush() {
  timer = null;
  if (pending.size === 0) {
    maybeReconcile();
    return;
  }
  const batch = Array.from(pending.values());
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
    // 200 OK → confirmed on the server. Drop only writes this batch saved:
    // a key tapped again mid-flight holds a NEWER write object that is still
    // unconfirmed and must stay queued (reference equality catches that).
    for (const w of batch) {
      const key = keyOf(w.taskId, w.date);
      if (pending.get(key) === w) pending.delete(key);
    }
    retryBackoff = 0;
  } catch {
    // Keep everything queued and retry with backoff — the cache (and thus
    // the UI) keeps the optimistic state, so nothing visibly reverts.
    retryBackoff = retryBackoff ? Math.min(retryBackoff * 2, 30_000) : 1_000;
    scheduleFlush();
  } finally {
    inFlight--;
    maybeReconcile();
  }
}

function maybeReconcile() {
  if (inFlight > 0 || pending.size > 0 || timer) return; // saves still settling
  if (resyncRequested) {
    resyncRequested = false;
    void boundMutate?.(); // full background re-fetch (overlays pending)
  }
}

/** Re-fetch once the coordinator is idle (used when returning to Daily). */
export function resyncWhenIdle() {
  resyncRequested = true;
  maybeReconcile(); // if already idle, refetch now; else flush/in-flight will trigger it
}

/**
 * Drop any queued (not yet flushed) writes — called on logout so the previous
 * user's debounced saves can't fire after their session is gone. In-flight
 * requests are left to finish; the next login re-fetches from scratch.
 */
export function resetCoordinator() {
  pending.clear();
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  resyncRequested = false;
  retryBackoff = 0;
}

/**
 * fetch with a few retries on transient (5xx / network) failures. Supabase
 * occasionally returns "JWT issued at future" on clock skew — a quick retry
 * usually clears it. 4xx are returned as-is (not retried); a 401 bounces to
 * the login page (session expired).
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
      if (res.status === 401) {
        redirectOn401();
        throw new Error("unauthenticated");
      }
      if (res.ok || res.status < 500) return res;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  throw last instanceof Error ? last : new Error("request failed");
}

/** Hard-navigate to /login (a full reload clears all client state). */
function redirectOn401() {
  if (typeof window === "undefined") return;
  const from = window.location.pathname + window.location.search;
  window.location.assign(
    "/login" + (from && from !== "/" ? `?from=${encodeURIComponent(from)}` : ""),
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useMutations() {
  const { mutate } = useDashboard();
  // The coordinator's re-fetch: fresh snapshot from the server, with any
  // not-yet-confirmed toggles laid back on top in the same cache write (no
  // flicker, no window for the response to visibly undo a tap). A fetch
  // failure keeps the current cache as-is.
  boundMutate = () =>
    mutate(
      async (cur) => {
        try {
          let next = await fetchDashboard(DASHBOARD_KEY);
          for (const w of pending.values()) next = applyWrite(next, w);
          return next;
        } catch {
          return cur ?? EMPTY;
        }
      },
      { revalidate: false },
    );

  const applyWrites = (writes: PendingWrite[]) => {
    mutate(
      (prev) => {
        let next = prev;
        for (const w of writes) next = applyWrite(next, w);
        return next;
      },
      { revalidate: false },
    );
  };

  const setCompletion = (taskId: string, date: string, status: CompletionStatus) => {
    const writes: PendingWrite[] = [
      { kind: "status", taskId, date, status },
    ];
    // No backfill: blanks are never written. scoreFromStatuses counts a
    // user's blanks as missed (for averages) once they've graded the day.
    applyWrites(writes);
    for (const w of writes) pending.set(keyOf(w.taskId, w.date), w);
    scheduleFlush();
  };

  const clearCompletion = (taskId: string, date: string) => {
    applyWrites([{ kind: "clear", taskId, date }]);
    pending.set(keyOf(taskId, date), { kind: "clear", taskId, date });
    scheduleFlush();
  };

  const addTask = async (userId: string, title: string) => {
    const res = await fetchRetry("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, title }),
    });
    if (!res.ok) throw new Error("add task failed");
    const { task } = (await res.json()) as { task: Task };
    await mutate(
      (cur) => ({ ...(cur ?? EMPTY), tasks: [...(cur ?? EMPTY).tasks, task] }),
      { revalidate: false },
    );
  };

  const updateTask = (taskId: string, title: string) =>
    mutate(
      async (cur) => {
        const res = await fetchRetry(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
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
            t.id === taskId ? { ...t, title } : t,
          ),
        }),
        rollbackOnError: true,
        populateCache: false,
        revalidate: false,
      },
    );

  /** Upsert a per-task-per-day note (debounced blur → one write). */
  const setTaskNote = (taskId: string, date: string, note: string) =>
    mutate(
      async (cur) => {
        const res = await fetchRetry("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId, date, note }),
        });
        if (!res.ok) throw new Error("note failed");
        const { note: saved } = (await res.json()) as { note: TaskNote };
        return upsertNote(cur, saved);
      },
      {
        optimisticData: (cur) =>
          upsertNote(cur, { id: "tmp", task_id: taskId, date, note }),
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
          notes: base.notes.filter((n) => n.task_id !== taskId),
        };
      },
      {
        optimisticData: (cur) => {
          const base = cur ?? EMPTY;
          return {
            ...base,
            tasks: base.tasks.filter((t) => t.id !== taskId),
            completions: base.completions.filter((c) => c.task_id !== taskId),
            notes: base.notes.filter((n) => n.task_id !== taskId),
          };
        },
        rollbackOnError: true,
        populateCache: false,
        revalidate: false,
      },
    );

  return {
    setCompletion,
    clearCompletion,
    addTask,
    updateTask,
    setTaskNote,
    deleteTask,
  };
}

// --- pure cache helpers (always return a full DashboardData) ---

/** Fold one queued write into a dashboard snapshot. */
function applyWrite(
  cur: DashboardData | undefined,
  w: PendingWrite,
): DashboardData {
  return w.kind === "status"
    ? upsertCompletion(cur, {
        id: "tmp",
        task_id: w.taskId,
        date: w.date,
        status: w.status,
      })
    : removeCompletion(cur, w.taskId, w.date);
}

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

function upsertNote(
  cur: DashboardData | undefined,
  note: TaskNote,
): DashboardData {
  const base = cur ?? EMPTY;
  const idx = base.notes.findIndex(
    (n) => n.task_id === note.task_id && n.date === note.date,
  );
  const notes =
    idx >= 0
      ? base.notes.map((n, i) => (i === idx ? { ...n, note: note.note } : n))
      : [...base.notes, note];
  return { ...base, notes };
}
