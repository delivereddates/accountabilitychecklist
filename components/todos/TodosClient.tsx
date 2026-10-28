"use client";

import { useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStorageAvailable, useTodos } from "@/lib/local/hooks";
import type { TodoRecord } from "@/lib/local/types";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoTree } from "./TodoTree";

type View = "list" | "tree";

export function TodosClient({ userId }: { userId: string }) {
  const todos = useTodos(userId);
  const storageOk = useStorageAvailable();
  const [view, setView] = useState<View>("list");

  const sorted = useMemo(() => sortTodos(todos ?? []), [todos]);
  const byId = useMemo(
    () => new Map(sorted.map((t) => [t.id, t] as const)),
    [sorted],
  );
  const openCount = sorted.filter((t) => !t.completed).length;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Todos</h1>
        {todos !== undefined && (
          <span className="text-sm text-[var(--muted)]">{openCount} open</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-sm">
            {(["list", "tree"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 capitalize transition-colors",
                  view === v
                    ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                    : "text-[var(--muted)]",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!storageOk && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)]">
          <CloudOff className="h-4 w-4 shrink-0" />
          Offline storage is unavailable in this browser (private mode?) —
          changes can&apos;t be saved.
        </p>
      )}

      <TodoForm userId={userId} todos={sorted} />

      {todos === undefined ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : view === "list" ? (
        <TodoList todos={sorted} byId={byId} />
      ) : (
        <TodoTree todos={sorted} byId={byId} />
      )}
    </div>
  );
}

/** Sort: open first, then date (nulls last), then creation order. */
function sortTodos(todos: TodoRecord[]): TodoRecord[] {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = a.date ?? "9999-12-31";
    const db = b.date ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}
