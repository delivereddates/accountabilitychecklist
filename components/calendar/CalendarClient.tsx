"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { cn, fromISODate, toISODate } from "@/lib/utils";
import { monthDays, weekDays } from "@/lib/dates";
import {
  useEvents,
  useNotes,
  useStorageAvailable,
  useTodos,
} from "@/lib/local/hooks";
import { buildDayFeed, buildRangeFeeds } from "@/lib/local/unified";
import { DateStepper } from "@/components/summary/DateStepper";
import { MonthGrid } from "./MonthGrid";
import { WeekView } from "./WeekView";
import { AgendaList } from "./AgendaList";
import { EventDialog, type DialogState } from "./EventDialog";

type View = "month" | "week" | "agenda";

const AGENDA_DAYS = 30;

export function CalendarClient({ userId }: { userId: string }) {
  const searchParams = useSearchParams();
  const events = useEvents(userId);
  const todos = useTodos(userId);
  const notes = useNotes(userId);
  const storageOk = useStorageAvailable();

  const [view, setView] = useState<View>("month");
  const paramDate = searchParams.get("date");
  const [anchor, setAnchor] = useState(
    /^\d{4}-\d{2}-\d{2}$/.test(paramDate ?? "") ? paramDate! : toISODate(new Date()),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const today = toISODate(new Date());
  const data = useMemo(
    () => ({ events: events ?? [], todos: todos ?? [], notes: notes ?? [] }),
    [events, todos, notes],
  );

  const month = useMemo(() => monthDays(anchor, "calendar"), [anchor]);
  const week = useMemo(() => weekDays(anchor, "calendar"), [anchor]);
  // Agenda covers today → +30d regardless of the anchor (it's the "upcoming" view).
  const agendaRange = useMemo(() => {
    const start = today;
    const end = toISODate(addDays(fromISODate(today), AGENDA_DAYS));
    return { start, end, days: rangeDays(start, end) };
  }, [today]);

  const monthFeeds = useMemo(
    () =>
      buildRangeFeeds(
        month.days[0],
        month.days[month.days.length - 1],
        data,
      ),
    [month, data],
  );
  const weekFeeds = useMemo(
    () => buildRangeFeeds(week[0], week[week.length - 1], data),
    [week, data],
  );
  const agendaFeeds = useMemo(
    () => buildRangeFeeds(agendaRange.start, agendaRange.end, data),
    [agendaRange, data],
  );

  function step(dir: 1 | -1) {
    const base = fromISODate(anchor);
    const next =
      view === "month"
        ? addMonths(base, dir)
        : view === "week"
          ? addWeeks(base, dir)
          : addWeeks(base, dir);
    const iso = toISODate(next);
    setAnchor(iso);
    setSelected(null);
    window.history.replaceState(null, "", `?date=${iso}`);
  }

  function goToday() {
    setAnchor(today);
    setSelected(null);
    window.history.replaceState(null, "", "?date=" + today);
  }

  const loading = events === undefined || todos === undefined || notes === undefined;
  const title =
    view === "week"
      ? `${format(parseISO(week[0]), "d MMM")} – ${format(parseISO(week[6]), "d MMM yyyy")}`
      : format(parseISO(anchor), view === "month" ? "MMMM yyyy" : "d MMM yyyy");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
        <span className="text-sm text-[var(--muted)]">{title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={goToday}
            className="h-9 rounded-lg border border-[var(--border)] px-2.5 text-sm text-[var(--muted)] hover:bg-black/5"
          >
            Today
          </button>
          <button
            onClick={() => setDialog({ date: anchor, startMin: null })}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-[var(--color-check)] px-2.5 text-sm font-semibold text-white"
          >
            <CalendarPlus className="h-4 w-4" />
            Event
          </button>
          <DateStepper
            value={anchor}
            onChange={(iso) => {
              setAnchor(iso);
              setSelected(null);
              window.history.replaceState(null, "", `?date=${iso}`);
            }}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
          <div className="flex rounded-lg border border-[var(--border)] p-0.5 text-sm">
            {(["month", "week", "agenda"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-md px-2.5 py-1 capitalize transition-colors",
                  view === v
                    ? "bg-[var(--color-check-soft)] font-semibold text-[var(--color-check)]"
                    : "text-[var(--muted)]",
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {!storageOk && (
        <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)]">
          Offline storage is unavailable in this browser (private mode?) —
          changes can&apos;t be saved.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : view === "month" ? (
        <>
          <MonthGrid
            days={month.days}
            leadOffset={month.leadOffset}
            feeds={monthFeeds}
            anchorMonth={parseISO(anchor).getMonth()}
            today={today}
            selected={selected}
            onSelect={(iso) => setSelected(iso === selected ? null : iso)}
          />
          {selected && (
            <DayDetail
              dateISO={selected}
              entries={buildDayFeed(selected, data)}
              onAdd={() => setDialog({ date: selected, startMin: null })}
              onEventClick={(id) => setDialog({ eventId: id, date: selected })}
            />
          )}
        </>
      ) : view === "week" ? (
        <WeekView
          days={week}
          events={data.events}
          feeds={weekFeeds}
          today={today}
          onSlotClick={(iso, startMin) => setDialog({ date: iso, startMin })}
          onEventClick={(id) => setDialog({ eventId: id, date: anchor })}
        />
      ) : (
        <AgendaList
          days={agendaRange.days}
          feeds={agendaFeeds}
          today={today}
          onEventClick={(id) => setDialog({ eventId: id, date: anchor })}
        />
      )}

      {dialog && (
        <EventDialog
          state={dialog}
          userId={userId}
          event={data.events.find((e) => e.id === dialog.eventId)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** Selected-day detail under the month grid (unified feed + add button). */
function DayDetail({
  dateISO,
  entries,
  onAdd,
  onEventClick,
}: {
  dateISO: string;
  entries: ReturnType<typeof buildDayFeed>;
  onAdd: () => void;
  onEventClick: (id: string) => void;
}) {
  return (
    <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {format(parseISO(dateISO), "EEEE d MMM")}
        <button
          onClick={onAdd}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] px-2 text-xs text-[var(--muted)] hover:bg-black/5"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Add event
        </button>
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Nothing this day — events, dated todos and dated notes appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((f) => (
            <li
              key={`${f.kind}:${f.id}`}
              className="flex items-center gap-2 text-sm"
            >
              <span className="w-14 shrink-0 text-xs tabular-nums text-[var(--muted)]">
                {f.time ?? "all day"}
              </span>
              {f.kind === "event" ? (
                <button
                  className="min-w-0 flex-1 truncate text-left hover:underline"
                  onClick={() => onEventClick(f.id)}
                >
                  {f.title}
                </button>
              ) : (
                <Link
                  href={f.kind === "todo" ? "/todos" : `/notes?id=${f.id}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {f.title}
                </Link>
              )}
              <span className="shrink-0 text-xs uppercase text-[var(--muted)]">
                {f.kind}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function rangeDays(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  let cur = startISO;
  for (let i = 0; i < 400 && cur <= endISO; i++) {
    out.push(cur);
    const d = addDays(fromISODate(cur), 1);
    cur = toISODate(d);
  }
  return out;
}
