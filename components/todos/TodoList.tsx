"use client";

import { isBlocked } from "@/lib/local/graph";
import { toISODate } from "@/lib/utils";
import type { TodoRecord } from "@/lib/local/types";
import { TodoItem } from "./TodoItem";

export type ListView = "current" | "dated" | "blocked";

/**
 * Flat list for the three tab views.
 *  - Current: the working set — unblocked todos that are undated, past due,
 *    or due within a week, bucketed Overdue / Today / Tomorrow / Next 7
 *    days / No date.
 *  - Dated: everything with a date, in date order (overlaps Current by
 *    design — it's the full schedule, near *and* far).
 *  - Blocked: everything locked by a live blocker.
 * Each ends with a "Done" section under the same filter.
 */
export function TodoList({
  todos,
  byId,
  variant,
  today,
  weekOut,
}: {
  todos: TodoRecord[];
  byId: Map<string, TodoRecord>;
  variant: ListView;
  today: string;
  weekOut: string;
}) {
  const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const inView = (t: TodoRecord) =>
    variant === "current"
      ? !isBlocked(t, byId) && (!t.date || t.date <= weekOut)
      : variant === "dated"
        ? !!t.date
        : isBlocked(t, byId);

  const open = todos.filter((t) => !t.completed && inView(t));
  const done = todos.filter((t) => t.completed && inView(t));

  const buckets =
    variant === "current"
      ? [
          {
            label: "Overdue",
            items: open.filter((t) => t.date && t.date < today),
          },
          { label: "Today", items: open.filter((t) => t.date === today) },
          { label: "Tomorrow", items: open.filter((t) => t.date === tomorrow) },
          {
            label: "Next 7 days",
            items: open.filter(
              (t) => t.date && t.date > tomorrow && t.date <= weekOut,
            ),
          },
          { label: "No date", items: open.filter((t) => !t.date) },
        ].filter((b) => b.items.length > 0)
      : [];

  const emptyLabel =
    variant === "current"
      ? "Nothing current — everything is blocked, dated beyond a week, or done."
      : variant === "dated"
        ? "Nothing dated."
        : "Nothing blocked.";

  return (
    <div className="flex flex-col gap-6">
      {variant === "current"
        ? buckets.map((b) => (
            <section key={b.label}>
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {b.label}
              </h2>
              <ul className="divide-y divide-[var(--border)]">
                {b.items.map((t) => (
                  <TodoItem
                    key={t.id}
                    todo={t}
                    todos={todos}
                    byId={byId}
                    today={today}
                  />
                ))}
              </ul>
            </section>
          ))
        : open.length > 0 && (
            <ul className="divide-y divide-[var(--border)]">
              {open.map((t) => (
                <TodoItem
                  key={t.id}
                  todo={t}
                  todos={todos}
                  byId={byId}
                  today={today}
                />
              ))}
            </ul>
          )}
      {done.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Done · {done.length}
          </h2>
          <ul className="divide-y divide-[var(--border)]">
            {done.map((t) => (
              <TodoItem
                key={t.id}
                todo={t}
                todos={todos}
                byId={byId}
                today={today}
              />
            ))}
          </ul>
        </section>
      )}
      {todos.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          Nothing here yet — add your first todo above.
        </p>
      )}
      {todos.length > 0 && open.length === 0 && (
        <p className="text-sm text-[var(--muted)]">{emptyLabel}</p>
      )}
    </div>
  );
}
