"use client";

import { useMemo } from "react";
import { toISODate } from "@/lib/utils";
import { buildForest } from "@/lib/local/graph";
import type { TodoRecord } from "@/lib/local/types";
import { TodoItem } from "./TodoItem";

const MAX_DEPTH = 32; // paranoia guard; wouldCreateCycle keeps the data clean

/** Dependency-tree view: each todo nests under its blocker. */
export function TodoTree({
  todos,
  byId,
  onEdit,
}: {
  todos: TodoRecord[];
  byId: Map<string, TodoRecord>;
  onEdit: (id: string) => void;
}) {
  const today = toISODate(new Date());
  const forest = useMemo(() => buildForest(todos), [todos]);

  if (todos.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Nothing here yet — tap + Add to create your first todo.
      </p>
    );
  }

  function renderBranch(parentId: string | null, depth: number) {
    const children = parentId === null ? forest.roots : (forest.childrenOf.get(parentId) ?? []);
    if (depth > MAX_DEPTH) return null;
    return (
      <ul
        className={
          depth === 0
            ? "divide-y divide-[var(--border)]"
            : "ml-4 border-l border-[var(--border)] pl-2"
        }
      >
        {children.map((t) => (
          <li key={t.id}>
            <TodoItem todo={t} byId={byId} today={today} onEdit={onEdit} />
            {renderBranch(t.id, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return <div>{renderBranch(null, 0)}</div>;
}
