"use client";

import { isBlocked } from "@/lib/local/graph";
import { toISODate } from "@/lib/utils";
import type { TodoRecord } from "@/lib/local/types";
import { TodoItem } from "./TodoItem";

export type ListView = "current" | "dated" | "blocked";

/**
 * Flat list for the three tab views.
 *  - Current: the working set — unblocked todos that are undated, past due,
 *    or due within a week, bucketed High priority (pinned above everything)
 *    / Overdue / Today / Tomorrow / Next 7 days / No date / Low priority
 *    (parked at the bottom). Tagged todos leave their date bucket for a
 *    priority bucket.
 *  - Dated: the forward schedule — everything dated today or later, in date
 *    order. Past-due todos are Current-only (the Overdue bucket).
 *  - Blocked: everything locked by a live blocker.
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
      ? !isBlocked(t, byId) && (!t.date || t.date <= weekOut)
      : variant === "dated"
        ? // Open past-due todos live in Current's Overdue bucket only; done
          // ones stay (a completed todo is never "overdue").
          !!t.date && (t.completed || t.date >= today)
        : isBlocked(t, byId);

  const open = todos.filter((t) => !t.completed && inView(t));
  const done = todos.filter((t) => t.completed && inView(t));
  const plain = open.filter((t) => !t.priority); // untagged keep the date buckets

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
          { label: "Low priority", items: open.filter((t) => t.priority === "low") },
        ].filter((b) => b.items.length > 0)
      : [];

  const emptyLabel =
    variant === "current"
      ? "Nothing current — everything is blocked, dated beyond a week, or done."
      : variant === "dated"
        ? "Nothing dated today or later — past-due lives in Current."
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
