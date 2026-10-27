"use client";

import { useMemo } from "react";
import { wouldCreateCycle } from "@/lib/local/graph";
import type { TodoRecord } from "@/lib/local/types";

/** Selects another todo as this one's blocker; cycling options are disabled. */
export function BlockerPicker({
  todos,
  selfId,
  value,
  onChange,
  className,
}: {
  todos: TodoRecord[];
  selfId?: string;
  value: string | null;
  onChange: (blockerId: string | null) => void;
  className?: string;
}) {
  const byId = useMemo(
    () => new Map(todos.map((t) => [t.id, t] as const)),
    [todos],
  );

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={
        className ??
        "h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)]"
      }
      aria-label="Blocker"
      title="Blocked by (optional)"
    >
      <option value="">No blocker</option>
      {todos
        .filter((t) => t.id !== selfId)
        .map((t) => {
          const cycles = selfId
            ? wouldCreateCycle(byId, selfId, t.id)
            : false;
          return (
            <option key={t.id} value={t.id} disabled={cycles}>
              {t.completed ? "✓ " : ""}
              {t.text.slice(0, 60) || "(untitled)"}
              {cycles ? " — would loop" : ""}
            </option>
          );
        })}
    </select>
  );
}
