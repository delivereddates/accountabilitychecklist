"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createTodo } from "@/lib/local/mutations";
import type { TodoRecord } from "@/lib/local/types";
import { BlockerPicker } from "./BlockerPicker";

/** Add form: text + optional date + optional blocker. Submits instantly. */
export function TodoForm({ userId, todos }: { userId: string; todos: TodoRecord[] }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [blockerId, setBlockerId] = useState<string | null>(null);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    void createTodo(userId, {
      text: trimmed,
      date: date || null,
      blockerId,
    });
    setText("");
    setDate("");
    setBlockerId(null); // instant — no await, no spinner
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-6 flex flex-wrap items-center gap-2"
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New todo…"
        className="h-9 min-w-[10rem] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--color-check)]"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        title="Date (optional)"
        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)]"
      />
      <BlockerPicker
        todos={todos}
        value={blockerId}
        onChange={setBlockerId}
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}
