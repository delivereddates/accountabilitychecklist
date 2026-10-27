"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, Trash2 } from "lucide-react";
import { cn, formatDDMMYY } from "@/lib/utils";
import { isBlocked } from "@/lib/local/graph";
import {
  CycleError,
  deleteTodo,
  toggleTodo,
  updateTodo,
} from "@/lib/local/mutations";
import type { TodoRecord } from "@/lib/local/types";
import { BlockerPicker } from "./BlockerPicker";

/**
 * One todo row, shared by the flat list and the dependency tree: checkbox,
 * inline text edit, blocked badge, date chip, blocker picker, delete. Every
 * control writes locally — instant, no network on the UI path.
 */
export function TodoItem({
  todo,
  todos,
  byId,
  today,
}: {
  todo: TodoRecord;
  todos: TodoRecord[];
  byId: Map<string, TodoRecord>;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = isBlocked(todo, byId);
  const overdue = !!todo.date && todo.date < today && !todo.completed;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commitText(next: string) {
    setEditing(false);
    const trimmed = next.trim();
    if (trimmed && trimmed !== todo.text) void updateTodo(todo.id, { text: trimmed });
  }

  function changeBlocker(blockerId: string | null) {
    setError(null);
    updateTodo(todo.id, { blockerId }).catch((e) => {
      if (e instanceof CycleError) setError(e.message);
    });
  }

  return (
    <li className="flex flex-col gap-1 py-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => void toggleTodo(todo.id)}
          aria-label={todo.completed ? "Mark not done" : "Mark done"}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            todo.completed
              ? "border-[var(--color-check)] bg-[var(--color-check)] text-white"
              : "border-[var(--border)] hover:border-[var(--color-check)]",
          )}
        >
          {todo.completed && <Check className="h-3.5 w-3.5" />}
        </button>

        {editing ? (
          <input
            ref={inputRef}
            defaultValue={todo.text}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitText(e.currentTarget.value);
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "min-w-0 flex-1 truncate text-left text-sm",
              todo.completed && "text-[var(--muted)] line-through",
            )}
            title="Edit"
          >
            {todo.text || "(untitled)"}
          </button>
        )}

        {blocked && (
          <span
            className="flex shrink-0 items-center gap-1 text-[var(--muted)]"
            title={`Waiting on: ${byId.get(todo.blockerId!)?.text ?? ""}`}
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}

        {todo.date && (
          <label
            className={cn(
              "shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-xs tabular-nums",
              overdue
                ? "bg-[var(--color-nocheck-soft)] text-[var(--color-nocheck)]"
                : "text-[var(--muted)] hover:bg-black/5",
            )}
            title={todo.completed ? "Date" : "Change date"}
          >
            {formatDDMMYY(todo.date)}
            <input
              type="date"
              value={todo.date}
              onChange={(e) =>
                void updateTodo(todo.id, { date: e.target.value || null })
              }
              className="sr-only"
            />
          </label>
        )}
        {!todo.date && (
          <label
            className="shrink-0 cursor-pointer rounded px-1 py-0.5 text-xs text-[var(--muted)] hover:bg-black/5"
            title="Set date"
          >
            ＋date
            <input
              type="date"
              value=""
              onChange={(e) =>
                e.target.value &&
                void updateTodo(todo.id, { date: e.target.value })
              }
              className="sr-only"
            />
          </label>
        )}

        <button
          onClick={() => void deleteTodo(todo.id)}
          aria-label="Delete todo"
          title="Delete (unblocks children)"
          className="shrink-0 text-[var(--muted)] hover:text-[var(--color-nocheck)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pl-7">
        <BlockerPicker
          todos={todos}
          selfId={todo.id}
          value={todo.blockerId}
          onChange={changeBlocker}
          className="h-7 max-w-[16rem] rounded border border-[var(--border)] bg-[var(--card)] px-1.5 text-xs text-[var(--muted)]"
        />
        {error && (
          <span className="text-xs text-[var(--color-nocheck)]" role="alert">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}
