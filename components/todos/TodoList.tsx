"use client";

import { toISODate } from "@/lib/utils";
import type { TodoRecord } from "@/lib/local/types";
import { TodoItem } from "./TodoItem";

/**
 * Flat list grouped by date bucket: Overdue / Today / Tomorrow / Later /
 * No date, then a collapsed-feel "Done" section at the end.
 */
export function TodoList({
  todos,
  byId,
}: {
  todos: TodoRecord[];
  byId: Map<string, TodoRecord>;
}) {
  const today = toISODate(new Date());
  const tomorrow = toISODate(
    new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
  );

  const open = todos.filter((t) => !t.completed);
  const done = todos.filter((t) => t.completed);

  const buckets: { label: string; items: TodoRecord[] }[] = [
    {
      label: "Overdue",
      items: open.filter((t) => t.date && t.date < today),
    },
    { label: "Today", items: open.filter((t) => t.date === today) },
    { label: "Tomorrow", items: open.filter((t) => t.date === tomorrow) },
    {
      label: "Later",
      items: open.filter((t) => t.date && t.date > tomorrow),
    },
    { label: "No date", items: open.filter((t) => !t.date) },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {buckets.map((b) => (
        <section key={b.label}>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {b.label}
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {b.items.map((t) => (
              <TodoItem key={t.id} todo={t} todos={todos} byId={byId} today={today} />
            ))}
          </ul>
        </section>
      ))}
      {done.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Done · {done.length}
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {done.map((t) => (
              <TodoItem key={t.id} todo={t} todos={todos} byId={byId} today={today} />
            ))}
          </ul>
        </section>
      )}
      {todos.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Nothing here yet — add your first todo above.
        </p>
      )}
    </div>
  );
}
