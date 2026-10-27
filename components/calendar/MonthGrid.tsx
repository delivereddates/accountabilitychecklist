"use client";

import { format, parseISO } from "date-fns";
import { CheckSquare, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedEntry } from "@/lib/local/unified";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month grid (Monday-first, matching the checklist's Month view). Each cell
 * shows event chips, a dot per dated todo (green when done), and a note
 * marker; clicking a cell selects the day for the detail list below.
 */
export function MonthGrid({
  days,
  leadOffset,
  feeds,
  anchorMonth, // 0-based month the grid represents
  today,
  selected,
  onSelect,
}: {
  days: string[];
  leadOffset: number;
  feeds: Map<string, FeedEntry[]>;
  anchorMonth: number;
  today: string;
  selected: string | null;
  onSelect: (dateISO: string) => void;
}) {
  const cells: (string | null)[] = [
    ...Array.from({ length: leadOffset }, () => null),
    ...days,
    // pad the tail so the grid rows are complete weeks
    ...Array.from({ length: (7 - ((leadOffset + days.length) % 7)) % 7 }, () => null),
  ];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[38rem]">
        <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-xl border border-[var(--border)] bg-[var(--border)]">
          {cells.map((iso, i) => {
            if (iso === null) return <div key={`empty-${i}`} className="min-h-20 bg-[var(--card)]/40" />;
            const feed = feeds.get(iso) ?? [];
            const events = feed.filter((f) => f.kind === "event");
            const todos = feed.filter((f) => f.kind === "todo");
            const notes = feed.filter((f) => f.kind === "note");
            const inMonth = parseISO(iso).getMonth() === anchorMonth;
            const isToday = iso === today;
            return (
              <button
                key={iso}
                onClick={() => onSelect(iso)}
                className={cn(
                  "flex min-h-20 flex-col gap-0.5 bg-[var(--card)] p-1.5 text-left align-top transition-colors hover:bg-black/[0.03]",
                  !inMonth && "opacity-40",
                  isToday && "bg-[var(--color-check-soft)]",
                  selected === iso && "ring-2 ring-inset ring-[var(--color-check)]",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums",
                    isToday ? "text-[var(--color-check)]" : "text-[var(--muted)]",
                  )}
                >
                  {format(parseISO(iso), "d")}
                </span>
                {events.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="truncate rounded bg-[var(--color-check-soft)] px-1 text-[0.68rem] leading-4 text-[var(--color-check)]"
                  >
                    {e.time ? `${e.time} ` : ""}
                    {e.title}
                  </span>
                ))}
                {events.length > 2 && (
                  <span className="text-[0.68rem] leading-4 text-[var(--muted)]">
                    +{events.length - 2} more
                  </span>
                )}
                {(todos.length > 0 || notes.length > 0) && (
                  <span className="mt-auto flex items-center gap-1 pt-0.5">
                    {todos.slice(0, 4).map((t) => (
                      <span
                        key={t.id}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          t.completed
                            ? "bg-[var(--color-check)]"
                            : "bg-[var(--muted)]",
                        )}
                        title={t.title}
                      />
                    ))}
                    {notes.length > 0 && (
                      <span title={`${notes.length} dated note(s)`}>
                        <StickyNote className="h-3 w-3 text-[var(--muted)]" />
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
          <CheckSquare className="h-3.5 w-3.5" /> Dots are dated todos (green
          when done); <StickyNote className="h-3.5 w-3.5" /> marks dated notes.
        </p>
      </div>
    </div>
  );
}
