"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Lock, Trash2, X } from "lucide-react";
import { cn, formatDDMMYY } from "@/lib/utils";
import { blockerLabel, isBlocked } from "@/lib/local/graph";
import {
  CycleError,
  deleteTodo,
  toggleTodo,
  updateTodo,
} from "@/lib/local/mutations";
import type { TodoRecord } from "@/lib/local/types";
import { BlockerPicker, type BlockerSelection } from "./BlockerPicker";

/**
 * One todo row, shared by the flat views and the dependency tree: checkbox,
 * inline multiline text edit, blocked badge, date chip (with an explicit
 * clear — Safari's date picker has none), blocker box, delete. Every control
 * writes locally — instant, no network on the UI path.
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
  const editRef = useRef<HTMLTextAreaElement>(null);
  const blocked = isBlocked(todo, byId);
  const overdue = !!todo.date && todo.date < today && !todo.completed;

  useEffect(() => {
    if (!editing) return;
    const el = editRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [editing]);

  function commitText(next: string) {
    setEditing(false);
    const trimmed = next.trim(); // outer only — inner newlines are content
    if (trimmed && trimmed !== todo.text) void updateTodo(todo.id, { text: trimmed });
  }

  function changeBlocker(next: BlockerSelection) {
    setError(null);
    updateTodo(todo.id, next).catch((e) => {
      if (e instanceof CycleError) setError(e.message);
    });
  }

  return (
    <li className="flex flex-col gap-1 py-1.5">
      <div className="flex items-start gap-2">
        <button
          onClick={() => void toggleTodo(todo.id)}
          aria-label={todo.completed ? "Mark not done" : "Mark done"}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
            todo.completed
              ? "border-[var(--color-check)] bg-[var(--color-check)] text-white"
              : "border-[var(--border)] hover:border-[var(--color-check)]",
          )}
        >
          {todo.completed && <Check className="h-3.5 w-3.5" />}
        </button>

        {editing ? (
          <textarea
            ref={editRef}
            defaultValue={todo.text}
            rows={1}
            onChange={(e) => {
              const el = e.currentTarget;
              el.style.height = "0px";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onBlur={(e) => commitText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitText(e.currentTarget.value);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="min-h-7 min-w-0 flex-1 resize-none rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-sm outline-none focus:border-[var(--color-check)]"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              "min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-sm",
              todo.completed && "text-[var(--muted)] line-through",
            )}
            title="Edit"
          >
            {todo.text || "(untitled)"}
          </button>
        )}

        {blocked && (
          <span
            className="mt-1 flex shrink-0 items-center gap-1 text-[var(--muted)]"
            title={`Waiting on: ${blockerLabel(todo, byId) ?? ""}`}
          >
            <Lock className="h-3.5 w-3.5" />
          </span>
        )}

        {todo.date ? (
          <>
            <label
              className={cn(
                "mt-0.5 shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-xs tabular-nums",
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
            <button
              onClick={() => void updateTodo(todo.id, { date: null })}
              aria-label="Clear date"
              title="Clear date"
              className="mt-0.5 shrink-0 text-[var(--muted)] hover:text-[var(--color-nocheck)]"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : (
          <label
            className="mt-0.5 shrink-0 cursor-pointer rounded px-1 py-0.5 text-xs text-[var(--muted)] hover:bg-black/5"
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
          className="mt-0.5 shrink-0 text-[var(--muted)] hover:text-[var(--color-nocheck)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 pl-7">
        <BlockerPicker
          todos={todos}
          selfId={todo.id}
          value={{ blockerId: todo.blockerId, blockerText: todo.blockerText ?? null }}
          onChange={changeBlocker}
          className="h-7 w-56 max-w-full rounded border border-[var(--border)] bg-[var(--card)] px-1.5 text-xs text-[var(--muted)] outline-none focus:border-[var(--color-check)]"
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
