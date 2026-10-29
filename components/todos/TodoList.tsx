"use client";

import { isBlocked } from "@/lib/local/graph";
import { toISODate } from "@/lib/utils";
import type { TodoRecord } from "@/lib/local/types";
import { TodoItem } from "./TodoItem";

export type ListView = "current" | "dated" | "blocked" | "low";

/**
 * Flat list for the four tab views.
 *  - Current: the working set — unblocked todos that are undated, past due,
 *    or due within a week, bucketed High priority (pinned above everything)
 *    / Overdue / Today / Tomorrow / Next 7 days / No date.
 *  - Dated: the forward schedule — everything dated today or later, in date
 *    order. Past-due todos are Current-only (the Overdue bucket).
 *  - Blocked: everything locked by a live blocker.
 *  - Low: the parking lot — every low-priority todo in one flat list. Low
 *    items are excluded from the other three views entirely; tagging
 *    something Low moves it out of sight until it's promoted.
 * Each ends with a "Done" section under the same filter.
 */
export function TodoList({
  todos,
  byId,
  variant,
  today,
  weekOut,
  onEdit,
}: {
  todos: TodoRecord[];
  byId: Map<string, TodoRecord>;
  variant: ListView;
  today: string;
  weekOut: string;
  onEdit: (id: string) => void;
}) {
  const tomorrow = toISODate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const inView = (t: TodoRecord) =>
    variant === "current"
      ? !isBlocked(t, byId) && (!t.date || t.date <= weekOut) && t.priority !== "low"
      : variant === "dated"
        ? // Open past-due todos live in Current's Overdue bucket only; done
          // ones stay (a completed todo is never "overdue").
          !!t.date && (t.completed || t.date >= today) && t.priority !== "low"
        : variant === "blocked"
          ? isBlocked(t, byId) && t.priority !== "low"
          : t.priority === "low";

  const open = todos.filter((t) => !t.completed && inView(t));
  const done = todos.filter((t) => t.completed && inView(t));
  // High is pinned in its own bucket; low is out of this view entirely, so
  // everything else keeps the date buckets.
  const plain = open.filter((t) => t.priority !== "high");

  const buckets =
    variant === "current"
      ? [
          { label: "High priority", items: open.filter((t) => t.priority === "high") },
          {
            label: "Overdue",
            items: plain.filter((t) => t.date && t.date < today),
          },
          { label: "Today", items: plain.filter((t) => t.date === today) },
          { label: "Tomorrow", items: plain.filter((t) => t.date === tomorrow) },
          {
            label: "Next 7 days",
            items: plain.filter(
              (t) => t.date && t.date > tomorrow && t.date <= weekOut,
            ),
          },
          { label: "No date", items: plain.filter((t) => !t.date) },
        ].filter((b) => b.items.length > 0)
      : [];

  const emptyLabel =
    variant === "current"
      ? "Nothing current — everything is blocked, low priority, dated beyond a week, or done."
      : variant === "dated"
        ? "Nothing dated today or later — past-due lives in Current."
        : variant === "blocked"
          ? "Nothing blocked."
          : "No low-priority todos.";

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
                    byId={byId}
                    today={today}
                    onEdit={onEdit}
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
                  byId={byId}
                  today={today}
                  onEdit={onEdit}
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
                byId={byId}
                today={today}
                onEdit={onEdit}
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
