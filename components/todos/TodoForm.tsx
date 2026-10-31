"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createTodo } from "@/lib/local/mutations";

// The draft text survives tab switches: start typing a todo, pop over to
// Notes, come back — it's still here. Per device, like the note-editor font
// preference; cleared on submit. (v1 drafts also stored date/blocker fields
// from the old multi-control form; they're ignored now.)
const DRAFT_KEY = "todo-draft-v1";

function readDraft(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return "";
    const d = JSON.parse(raw) as { text?: unknown };
    return typeof d.text === "string" ? d.text : "";
  } catch {
    return ""; // corrupt/private-mode — start clean
  }
}

/**
 * Add form: one line, text + Add. Everything else (date, priority, blocker)
 * lives in the tap-to-edit sheet — creation stays as light as typing.
 * Enter submits; the draft persists across tab switches.
 */
export function TodoForm({ userId }: { userId: string }) {
  const [text, setText] = useState(readDraft);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ text }));
    } catch {
      // Private mode etc. — the form still works for this visit.
    }
  }, [text]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    void createTodo(userId, { text: trimmed });
    setText(""); // instant — no await, no spinner
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-4 flex gap-2"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New todo…"
        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--color-check)]"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        aria-label="Add todo"
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}
