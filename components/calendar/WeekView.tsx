"use client";

import { useEffect, useMemo, useRef } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { EventRecord } from "@/lib/local/types";
import type { FeedEntry } from "@/lib/local/unified";

const HOUR_H = 48; // px per hour row — 24h totals 1152px, scrolled container

/**
 * Week view with hour slots (Monday-first). Timed events are positioned by
 * start/end minutes; all-day events + dated todos/notes sit in the top row.
 * Clicking an empty slot opens the event dialog prefilled to that half hour.
 */
export function WeekView({
  days,
  events,
  feeds,
  today,
  onSlotClick,
  onEventClick,
}: {
  days: string[];
  events: EventRecord[];
  feeds: Map<string, FeedEntry[]>;
  today: string;
  onSlotClick: (dateISO: string, startMin: number) => void;
  onEventClick: (eventId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const nowMin = useMemo(() => {
    if (!days.includes(today)) return null;
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }, [days, today]);

  // Auto-scroll to ~07:00 so the working day is centered on open.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 6.5 * HOUR_H;
  }, []);

  const byId = useMemo(
    () => new Map(events.map((e) => [e.id, e] as const)),
    [events],
  );

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[44rem]">
        {/* Weekday headers */}
        <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-px border border-[var(--border)] bg-[var(--border)]">
          <div className="bg-[var(--card)]" />
          {days.map((iso) => (
            <div
              key={iso}
              className={cn(
                "bg-[var(--card)] py-1 text-center text-xs font-semibold",
                iso === today
                  ? "text-[var(--color-check)]"
                  : "text-[var(--muted)]",
              )}
            >
              {format(parseISO(iso), "EEE d")}
            </div>
          ))}
        </div>

        {/* All-day row */}
        <div className="my-px grid grid-cols-[3rem_repeat(7,1fr)] gap-px border border-[var(--border)] bg-[var(--border)]">
          <div className="bg-[var(--card)] p-1 text-center text-[0.6rem] uppercase text-[var(--muted)]">
            all day
          </div>
          {days.map((iso) => {
            const allday = (feeds.get(iso) ?? []).filter((f) => f.allDay);
            return (
              <div
                key={iso}
                className={cn(
                  "flex min-h-10 flex-col gap-0.5 bg-[var(--card)] p-1",
                  iso === today && "bg-[var(--color-check-soft)]",
                )}
              >
                {allday.slice(0, 2).map((f) => (
                  <span
                    key={f.id}
                    className={cn(
                      "truncate rounded px-1 text-[0.68rem] leading-4",
                      f.kind === "event"
                        ? "bg-[var(--color-check-soft)] text-[var(--color-check)]"
                        : "text-[var(--muted)]",
                    )}
                    title={f.title}
                  >
                    {f.title}
                  </span>
                ))}
                {allday.length > 2 && (
                  <span className="text-[0.68rem] leading-4 text-[var(--muted)]">
                    +{allday.length - 2}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Hour grid */}
        <div ref={scroller} className="max-h-[70vh] overflow-y-auto rounded-b-xl border border-t-0 border-[var(--border)]">
          <div className="grid grid-cols-[3rem_repeat(7,1fr)]">
            {/* hour labels */}
            <div>
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={h}
                  className="relative border-t border-[var(--border)] pr-1 pt-0.5 text-right text-[0.65rem] tabular-nums text-[var(--muted)]"
                  style={{ height: HOUR_H }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {days.map((iso) => {
              const timed = (feeds.get(iso) ?? []).filter((f) => !f.allDay);
              return (
                <div
                  key={iso}
                  className={cn(
                    "relative border-l border-[var(--border)]",
                    iso === today && "bg-[var(--color-check-soft)]/30",
                  )}
                  style={{ height: 24 * HOUR_H }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const min = Math.floor(
                      ((e.clientY - rect.top) / rect.height) * 1440,
                    );
                    onSlotClick(iso, Math.max(0, Math.min(1410, Math.round(min / 30) * 30)));
                  }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="border-t border-[var(--border)]"
                      style={{ height: HOUR_H }}
                    />
                  ))}
                  {timed.map((f) => {
                    const ev = f.kind === "event" ? byId.get(f.id) : undefined;
                    if (!ev) return null;
                    const start = ev.startMin ?? 0;
                    const dur = Math.max(30, (ev.endMin ?? start + 60) - start);
                    return (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev.id);
                        }}
                        className="absolute inset-x-0.5 overflow-hidden rounded border border-[var(--color-check)] bg-[var(--color-check-soft)] px-1 py-0.5 text-left text-[0.68rem] leading-4"
                        style={{
                          top: `${(start / 1440) * 100}%`,
                          height: `calc(${(dur / 1440) * 100}% - 2px)`,
                          minHeight: 18,
                        }}
                      >
                        <span className="block truncate font-semibold text-[var(--color-check)]">
                          {ev.title || "(untitled)"}
                        </span>
                        <span className="block truncate text-[var(--muted)]">
                          {f.time}
                          {ev.location ? ` · ${ev.location}` : ""}
                        </span>
                      </button>
                    );
                  })}
                  {iso === today && nowMin !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 border-t-2 border-red-500"
                      style={{ top: `${(nowMin / 1440) * 100}%` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Tap an empty slot to add an event at that time.
        </p>
      </div>
    </div>
  );
}
