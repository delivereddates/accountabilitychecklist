"use client";

import { useMemo, useState } from "react";
import { CloudOff } from "lucide-react";
import { cn, toISODate } from "@/lib/utils";
import { useLocalUserId, useStorageAvailable, useTodos } from "@/lib/local/hooks";
import type { TodoRecord } from "@/lib/local/types";
import { TodoForm } from "./TodoForm";
import { TodoList } from "./TodoList";
import { TodoTree } from "./TodoTree";
import { TodoEditDialog } from "./TodoEditDialog";

type View = "current" | "dated" | "blocked" | "tree";

const VIEWS: { key: View; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "dated", label: "Dated" },
  { key: "blocked", label: "Blocked" },
  { key: "tree", label: "Tree" },
];

// The chosen view sticks across tab switches (per device, like the draft).
const VIEW_KEY = "todo-view-v1";

function readView(): View {
  if (typeof window === "undefined") return "current";
  const v = window.localStorage.getItem(VIEW_KEY);
  return VIEWS.some((x) => x.key === v) ? (v as View) : "current";
}

export function TodosClient() {
  const userId = useLocalUserId();
  const todos = useTodos(userId);
  const storageOk = useStorageAvailable();
  const [view, setView] = useState<View>(readView);
  // The todo whose edit sheet is open (null = closed). Held here, above the
  // lists, so the sheet stays open even when an edit moves the todo out of
  // the view it was opened from.
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => sortTodos(todos ?? []), [todos]);
  const byId = useMemo(
    () => new Map(sorted.map((t) => [t.id, t] as const)),
    [sorted],
  );
  const openCount = sorted.filter((t) => !t.completed).length;
  const today = toISODate(new Date());
  const weekOut = toISODate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  function chooseView(v: View) {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      // Private mode etc. — the choice lasts for this visit.
    }
  }

  if (!userId) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight">Todos</h1>
        {todos !== undefined && (
          <span className="text-sm text-[var(--muted)]">{openCount} open</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-xs">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => chooseView(v.key)}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  view === v.key
                    ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                    : "text-[var(--muted)]",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!storageOk && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)]">
          <CloudOff className="h-4 w-4 shrink-0" />
          Offline storage is unavailable in this browser (private mode?) —
          changes can&rsquo;t be saved.
        </p>
      )}

      <TodoForm userId={userId} todos={sorted} />

      {todos === undefined ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : view === "tree" ? (
        <TodoTree todos={sorted} byId={byId} onEdit={setEditingId} />
      ) : (
        <TodoList
          todos={sorted}
          byId={byId}
          variant={view}
          today={today}
          weekOut={weekOut}
          onEdit={setEditingId}
        />
      )}

      {editingId && (() => {
        const editing = sorted.find((t) => t.id === editingId);
        return editing ? (
          <TodoEditDialog
            todo={editing}
            todos={sorted}
            onClose={() => setEditingId(null)}
          />
        ) : null; // deleted mid-edit (another device) — just close
      })()}
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
