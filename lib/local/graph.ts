import type { TodoRecord } from "./types";

// Dependency-graph helpers for todo blockers. Each todo has at most ONE
// blocker, so the graph is a forest of linked lists — every walk is O(depth).

/**
 * Would setting `todoId`'s blocker to `newBlockerId` create a cycle? Walks UP
 * from the proposed blocker through its blocker chain; re-reaching `todoId`
 * means a loop. A `seen` set guards against pre-corrupted data looping
 * forever.
 */
export function wouldCreateCycle(
  byId: Map<string, TodoRecord>,
  todoId: string,
  newBlockerId: string | null,
): boolean {
  if (!newBlockerId) return false;
  let cur: string | null = newBlockerId;
  const seen = new Set<string>();
  while (cur) {
    if (cur === todoId) return true;
    if (seen.has(cur)) return true; // pre-existing loop in stored data
    seen.add(cur);
    cur = byId.get(cur)?.blockerId ?? null;
  }
  return false;
}

export interface TodoForest {
  /** Todos whose blocker is null, deleted, or dangling (missing id). */
  roots: TodoRecord[];
  /** blockerId → todos directly blocked by it. */
  childrenOf: Map<string, TodoRecord[]>;
}

/** Group non-deleted todos into a forest; dangling blocker refs become roots. */
export function buildForest(todos: TodoRecord[]): TodoForest {
  const byId = new Map(todos.filter((t) => !t.deleted).map((t) => [t.id, t]));
  const roots: TodoRecord[] = [];
  const childrenOf = new Map<string, TodoRecord[]>();
  for (const t of todos) {
    if (t.deleted) continue;
    const b = t.blockerId;
    if (b && byId.has(b)) {
      const list = childrenOf.get(b);
      if (list) list.push(t);
      else childrenOf.set(b, [t]);
    } else {
      roots.push(t);
    }
  }
  return { roots, childrenOf };
}

/**
 * A todo is blocked while its blocker exists, isn't deleted, isn't completed.
 * A free-text blocker (blockerText) always blocks — nothing to complete, so
 * it clears only manually. Truthiness also covers pre-blockerText local rows
 * where the field is undefined.
 */
export function isBlocked(
  todo: TodoRecord,
  byId: Map<string, TodoRecord>,
): boolean {
  if (todo.blockerText) return true;
  if (!todo.blockerId) return false;
  const b = byId.get(todo.blockerId);
  return !!b && !b.deleted && !b.completed;
}

/** Human label for the blocker: the referenced todo's current text, or the
 *  free text. Null when there's no (resolvable) blocker to show. */
export function blockerLabel(
  todo: TodoRecord,
  byId: Map<string, TodoRecord>,
): string | null {
  if (todo.blockerId) {
    const b = byId.get(todo.blockerId);
    if (b && !b.deleted) return b.text;
    return null;
  }
  return todo.blockerText || null;
}

/** All transitive children of `todoId` (direct children + their children…). */
export function descendantIds(
  todoId: string,
  childrenOf: Map<string, TodoRecord[]>,
): Set<string> {
  const out = new Set<string>();
  const queue = [todoId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const child of childrenOf.get(cur) ?? []) {
      if (!out.has(child.id)) {
        out.add(child.id);
        queue.push(child.id);
      }
    }
  }
  return out;
}
