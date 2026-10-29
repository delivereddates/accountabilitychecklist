"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { createTodo } from "@/lib/local/mutations";
import type { TodoRecord } from "@/lib/local/types";
import { BlockerPicker } from "./BlockerPicker";

// The add-form draft survives tab switches: start typing a todo, pop over to
// Notes, come back — the text (and date/blocker) are still here. Per device,
// like the note-editor font preference; cleared on submit.
const DRAFT_KEY = "todo-draft-v1";

interface Draft {
  text: string;
  date: string;
  blockerId: string | null;
  blockerText: string | null;
}

const EMPTY_DRAFT: Draft = {
  text: "",
  date: "",
  blockerId: null,
  blockerText: null,
};

function readDraft(): Draft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY_DRAFT;
    const d = JSON.parse(raw) as Partial<Draft>;
    return {
      text: typeof d.text === "string" ? d.text : "",
      date: typeof d.date === "string" ? d.date : "",
      blockerId: typeof d.blockerId === "string" ? d.blockerId : null,
      blockerText: typeof d.blockerText === "string" ? d.blockerText : null,
    };
  } catch {
    return EMPTY_DRAFT; // corrupt/private-mode — start clean
  }
}

/**
 * Add form: multiline text (Shift+Enter = newline) + optional date + optional
 * blocker. Submits instantly; the draft persists across tab switches.
 */
export function TodoForm({
  userId,
  todos,
}: {
  userId: string;
  todos: TodoRecord[];
}) {
  const [draft, setDraft] = useState<Draft>(readDraft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: one line tall at first (like the old input), taller as needed.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.text]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private mode etc. — the form still works for this visit.
    }
  }, [draft]);

  function submit() {
    const trimmed = draft.text.trim();
    if (!trimmed) return;
    void createTodo(userId, {
      text: trimmed,
      date: draft.date || null,
      blockerId: draft.blockerId,
      blockerText: draft.blockerText,
    });
    setDraft(EMPTY_DRAFT); // instant — no await, no spinner
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mb-6 flex flex-wrap items-start gap-2"
    >
      <textarea
        ref={textareaRef}
        value={draft.text}
        rows={1}
        onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="New todo… (Shift+Enter for a new line)"
        className="min-h-9 min-w-[10rem] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm outline-none focus:border-[var(--color-check)]"
      />
      <div className="flex items-center gap-0.5">
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          title="Date (optional)"
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)]"
        />
        {draft.date && (
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, date: "" }))}
            aria-label="Clear date"
            title="Clear date"
            className="flex h-9 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--color-nocheck)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <BlockerPicker
        todos={todos}
        value={{ blockerId: draft.blockerId, blockerText: draft.blockerText }}
        onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
      />
      <button
        type="submit"
        disabled={!draft.text.trim()}
        className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}
