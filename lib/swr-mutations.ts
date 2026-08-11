"use client";

import { useDashboard, type DashboardData } from "./use-dashboard";
import {
  buildCompletionIndex,
  getStatus,
  tasksActiveOnDate,
} from "./scoring";
import type { CompletionStatus, Task, TaskCompletion } from "./types";

const EMPTY: DashboardData = { users: [], tasks: [], completions: [] };

/**
 * Mutations that optimistically update the shared SWR cache and write through to
 * the API. Frequent ops (toggle/clear/rename/delete) are optimistic with rollback;
 * add-user/add-task await the server first (it generates the id) then update.
 */
export function useMutations() {
  const { mutate } = useDashboard();

  const setCompletion = (taskId: string, date: string, status: CompletionStatus) =>
    mutate(
      async (cur) => {
        const task = cur?.tasks.find((t) => t.id === taskId);
        const res = await fetch("/api/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: taskId,
            date,
            status,
            user_id: task?.user_id,
          }),
        });
        if (!res.ok) throw new Error("save failed");
        const body = (await res.json()) as {
          completion: TaskCompletion;
          finalized?: TaskCompletion[];
        };
        let next = upsertCompletion(cur, body.completion);
        for (const f of body.finalized ?? []) next = upsertCompletion(next, f);
        return next;
      },
      {
        optimisticData: (cur) => {
          let next = upsertCompletion(cur, {
            id: "tmp",
            task_id: taskId,
            date,
            status,
          });
          // Checking finalizes the day: optimistically mark this user's other
          // still-unset active tasks as no_check (matches server finalizeDay).
          if (status === "check" && cur) {
            const task = cur.tasks.find((t) => t.id === taskId);
            if (task) {
              const idx = buildCompletionIndex(cur.completions);
              const active = tasksActiveOnDate(
                cur.tasks.filter((t) => t.user_id === task.user_id),
                date,
              );
              for (const s of active) {
                if (getStatus(idx, s.id, date) === undefined) {
                  next = upsertCompletion(next, {
                    id: "tmp",
                    task_id: s.id,
                    date,
                    status: "no_check",
                  });
                }
              }
            }
          }
          return next;
        },
        rollbackOnError: true,
        revalidate: false,
      },
    );

  const clearCompletion = (taskId: string, date: string) =>
    mutate(
      async (cur) => {
        const res = await fetch(
          `/api/completions?task_id=${encodeURIComponent(taskId)}&date=${encodeURIComponent(date)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("clear failed");
        return removeCompletion(cur, taskId, date);
      },
      {
        optimisticData: (cur) => removeCompletion(cur, taskId, date),
        rollbackOnError: true,
        revalidate: false,
      },
    );

  const addUser = async (name: string) => {
    const res = await fetch("/api/users", {
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
    const res = await fetch("/api/tasks", {
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
        const res = await fetch(`/api/tasks/${taskId}`, {
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
        const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
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
        const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
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
