"use client";

import { useDashboard, type DashboardData } from "./use-dashboard";
import type { CompletionStatus, Task, TaskCompletion } from "./types";

const EMPTY: DashboardData = { users: [], tasks: [], completions: [] };

/**
 * fetch with a few retries on transient (5xx / network) failures. Supabase
 * occasionally returns "JWT issued at future" on clock skew — a quick retry
 * usually clears it, so the user doesn't see a rollback/"disappear".
 * 4xx responses are returned as-is (not retried).
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

/**
 * Mutations that optimistically update the shared SWR cache and write through
 * to the API. Frequent ops (toggle/clear/update/delete) are optimistic with
 * rollback; add-user/add-task await the server first (it generates the id).
 */
export function useMutations() {
  const { mutate } = useDashboard();

  const setCompletion = (taskId: string, date: string, status: CompletionStatus) => {
    // Optimistic as a plain composing updater (NOT optimisticData/rollback):
    // each toggle reads the latest cache, so rapid successive clicks never
    // clobber each other via a stale rollback snapshot.
    mutate(
      (cur) => upsertCompletion(cur, { id: "tmp", task_id: taskId, date, status }),
      { revalidate: false },
    );
    // Persist + reconcile in the background.
    void (async () => {
      try {
        const res = await fetchRetry("/api/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId, date, status }),
        });
        if (!res.ok) throw new Error("save failed");
        const body = (await res.json()) as {
          completion: TaskCompletion;
          finalized?: TaskCompletion[];
        };
        mutate((cur) => {
          let next = upsertCompletion(cur, body.completion);
          for (const f of body.finalized ?? []) next = upsertCompletion(next, f);
          return next;
        }, { revalidate: false });
      } catch {
        mutate(); // hard failure: revalidate from the server
      }
    })();
  };

  const clearCompletion = (taskId: string, date: string) => {
    mutate((cur) => removeCompletion(cur, taskId, date), { revalidate: false });
    void (async () => {
      try {
        const res = await fetchRetry(
          `/api/completions?task_id=${encodeURIComponent(taskId)}&date=${encodeURIComponent(date)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("clear failed");
        mutate((cur) => removeCompletion(cur, taskId, date), { revalidate: false });
      } catch {
        mutate();
      }
    })();
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

  /** Update title and/or notes for a task. */
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
