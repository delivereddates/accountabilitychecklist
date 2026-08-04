"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, toISODate } from "@/lib/utils";
import type { WindowMode } from "@/lib/dates";
import {
  buildCompletionIndex,
  getStatus,
  scoreOverallDate,
  tasksActiveOnDate,
} from "@/lib/scoring";
import type { Task, TaskCompletion, User } from "@/lib/types";
import { ModeToggle } from "./ModeToggle";
import { StatusGlyph, StatusLegend } from "./StatusGlyph";

interface Props {
  users: User[];
  tasks: Task[];
  completions: TaskCompletion[];
  days: string[];
  anchorISO: string;
  mode: WindowMode;
  todayISO: string;
}

export function WeekView(props: Props) {
  const router = useRouter();
  const { users, tasks, days, anchorISO, mode, todayISO } = props;

  const index = useMemo(
    () => buildCompletionIndex(props.completions),
    [props.completions],
  );

  function go(anchor: string, m: WindowMode) {
    const p = new URLSearchParams({ date: anchor, mode: m });
    router.push(`/week?${p.toString()}`);
  }
  const shift = (n: number) =>
    go(toISODate(addDays(parseISO(anchorISO), n)), mode);

  // status for a task/day; future days and missing rows are "no data" (undefined)
  const statusFor = (taskId: string, iso: string, future: boolean) =>
    future ? undefined : getStatus(index, taskId, iso);

  return (
    <div className="space-y-4">
      {/* One-line header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <h1 className="shrink-0 text-lg font-semibold tracking-tight">Week</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <ModeToggle
            mode={mode}
            onChange={(m) => go(anchorISO, m)}
            rollingLabel="Last 7"
            calendarLabel="Mon–Sun"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => shift(-7)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={anchorISO}
              onChange={(e) => e.target.value && go(e.target.value, mode)}
              className="h-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-base outline-none focus:border-[var(--color-check)]"
            />
            <button
              onClick={() => shift(7)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <StatusLegend />

      {/* Matrix — border-separate makes sticky columns reliable. */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="[&>th]:border-b [&>th]:border-[var(--border)]">
              <th className="sticky left-0 z-10 bg-[var(--card)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Task
              </th>
              {days.map((d) => {
                const dt = parseISO(d);
                const today = isToday(dt);
                const future = d > todayISO;
                const overall = scoreOverallDate(tasks, index, d);
                const pct =
                  overall.percent == null
                    ? null
                    : Math.round(overall.percent * 100);
                return (
                  <th key={d} className="px-2 py-2 text-center align-bottom">
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          today && "font-bold text-[var(--color-check)]",
                          !today && "font-medium",
                        )}
                      >
                        {format(dt, "EEEEE")}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {format(dt, "d")}
                      </span>
                      <span className="text-[10px] text-[var(--muted)]">
                        {future || pct == null ? "—" : `${pct}%`}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={days.length + 1}
                  className="px-3 py-8 text-center text-[var(--muted)]"
                >
                  No users yet — add some on the Daily page.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const userTasks = tasks.filter((t) => t.user_id === u.id);
              return (
                <Fragment key={u.id}>
                  <tr className="bg-[#f3f4f6] [&>td]:border-t [&>td]:border-[var(--border)]">
                    <td className="sticky left-0 z-10 bg-[#f3f4f6] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {u.name}
                    </td>
                    {days.map((d) => (
                      <td key={d} />
                    ))}
                  </tr>
                  {userTasks.length === 0 ? (
                    <tr className="[&>td]:border-t [&>td]:border-[var(--border)]">
                      <td
                        colSpan={days.length + 1}
                        className="px-3 py-2 text-xs text-[var(--muted)]"
                      >
                        No tasks
                      </td>
                    </tr>
                  ) : (
                    userTasks.map((t) => (
                      <tr
                        key={t.id}
                        className="[&>td]:border-t [&>td]:border-[var(--border)]"
                      >
                        <td className="sticky left-0 z-10 max-w-[14rem] truncate bg-[var(--card)] px-3 py-2 font-medium">
                          {t.title}
                        </td>
                        {days.map((d) => {
                          const future = d > todayISO;
                          const active = tasksActiveOnDate([t], d).length > 0;
                          return (
                            <td
                              key={d}
                              className="px-2 py-2 text-center align-middle"
                            >
                              {active ? (
                                <StatusGlyph
                                  status={statusFor(t.id, d, future)}
                                  className="mx-auto h-4 w-4"
                                />
                              ) : (
                                <span className="text-[var(--muted)] opacity-40">
                                  ·
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
