"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { wouldCreateCycle } from "@/lib/local/graph";
import type { TodoRecord } from "@/lib/local/types";

/** What a todo is blocked by: another todo (by id) or free text — never both. */
export interface BlockerSelection {
  blockerId: string | null;
  blockerText: string | null;
}

const MAX_SUGGESTIONS = 8;

/** "a\n  b" → "a b" — todo text can be multiline; the one-line box can't. */
function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Type-as-you-go blocker box. Typing suggests matching todos (picking one
 * links by id, so completing it unblocks this todo); anything else — "waiting
 * on the visa" — commits as free text that only clears manually. Empty input
 * means no blocker. Suggestions that would create a loop are shown disabled.
 */
export function BlockerPicker({
  todos,
  selfId,
  value,
  onChange,
  className,
  autoFocus,
}: {
  todos: TodoRecord[];
  selfId?: string;
  value: BlockerSelection;
  onChange: (next: BlockerSelection) => void;
  className?: string;
  /** Focus on mount — for rows that reveal the box on demand. */
  autoFocus?: boolean;
}) {
  const byId = useMemo(
    () => new Map(todos.map((t) => [t.id, t] as const)),
    [todos],
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [query, setQuery] = useState(() =>
    value.blockerId ? collapse(byId.get(value.blockerId)?.text ?? "") : (value.blockerText ?? ""),
  );
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const display = useMemo(
    () =>
      value.blockerId
        ? collapse(byId.get(value.blockerId)?.text ?? "")
        : (value.blockerText ?? ""),
    [value.blockerId, value.blockerText, byId],
  );

  // Mirror outside changes (another device, a completed blocker) into the box
  // — but never clobber text the user is actively typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setQuery(display);
  }, [display]);

  const suggestions = useMemo(() => {
    const q = collapse(query).toLowerCase();
    return todos
      .filter((t) => t.id !== selfId)
      .filter((t) => !q || collapse(t.text).toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS)
      .map((t) => ({
        todo: t,
        cycles: selfId ? wouldCreateCycle(byId, selfId, t.id) : false,
      }));
  }, [todos, selfId, byId, query]);

  function pick(index: number) {
    const s = suggestions[index];
    if (!s || s.cycles) return;
    if (s.todo.id !== value.blockerId) {
      onChange({ blockerId: s.todo.id, blockerText: null });
    }
    setQuery(collapse(s.todo.text));
    setOpen(false);
  }

  /** Commit whatever is typed as a free-text blocker (empty = no blocker). */
  function commitFree(q: string) {
    const trimmed = collapse(q);
    if (!trimmed) {
      if (value.blockerId || value.blockerText) {
        onChange({ blockerId: null, blockerText: null });
      }
      setQuery("");
      return;
    }
    // Unedited box (still showing the linked todo's text) keeps the link.
    if (value.blockerId && trimmed === display) return;
    if (value.blockerText && trimmed === value.blockerText) return;
    onChange({ blockerId: null, blockerText: trimmed });
  }

  return (
    <div className="relative inline-flex">
      <input
        ref={inputRef}
        value={query}
        autoFocus={autoFocus}
        onFocus={() => {
          setOpen(true);
          setHighlight(suggestions.findIndex((s) => !s.cycles));
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(suggestions.findIndex((s) => !s.cycles));
        }}
        onBlur={() => {
          commitFree(query);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            let i = highlight;
            for (let n = 0; n < suggestions.length; n++) {
              i = (i + step + suggestions.length) % suggestions.length;
              if (!suggestions[i].cycles) break;
            }
            setHighlight(i);
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            if (open && highlight >= 0 && !suggestions[highlight]?.cycles) {
              pick(highlight);
            } else {
              commitFree(query);
              setOpen(false);
            }
            return;
          }
          if (e.key === "Escape") {
            // Keep Escape local: close just the suggestion list (a second
            // Escape can then close the surrounding sheet, if any).
            e.stopPropagation();
            setQuery(display);
            setOpen(false);
          }
        }}
        placeholder="Waiting on… (optional)"
        className={
          className ??
          "h-9 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm text-[var(--muted)] outline-none focus:border-[var(--color-check)]"
        }
        aria-label="Blocker"
        title="Blocked by (optional) — pick a todo or type anything"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />

      {open && (
        <ul
          id={listboxId}
          className="absolute left-0 top-full z-30 mt-1 max-h-56 w-max min-w-full max-w-[20rem] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)] py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((s, i) => (
            <li key={s.todo.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()} // keep input focus
                onClick={() => pick(i)}
                disabled={s.cycles}
                className={cn(
                  "block w-full px-2 py-1.5 text-left text-xs",
                  s.cycles
                    ? "cursor-not-allowed text-[var(--muted)] opacity-50"
                    : "hover:bg-black/5",
                  i === highlight && !s.cycles && "bg-black/5",
                )}
              >
                {s.todo.completed ? "✓ " : ""}
                {collapse(s.todo.text).slice(0, 60) || "(untitled)"}
                {s.cycles ? " — would loop" : ""}
              </button>
            </li>
          ))}
          <li className="px-2 py-1 text-[11px] text-[var(--muted)]">
            Blockers don&apos;t have to be todos — type anything.
          </li>
        </ul>
      )}
    </div>
  );
}
