"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addYears, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISODate } from "@/lib/utils";
import type { WindowMode } from "@/lib/dates";
import {
  buildCompletionIndex,
  scoreUserDate,
  type CompletionIndex,
  type Score,
} from "@/lib/scoring";
import { percentColor } from "@/lib/colors";
import type { Task, TaskCompletion, User } from "@/lib/types";
import { ModeToggle } from "./ModeToggle";

interface Props {
  users: User[];
  tasks: Task[];
  completions: TaskCompletion[];
  days: string[];
  anchorISO: string;
  mode: WindowMode;
}

const SIZE = 560;
const CX = SIZE / 2;
const CY = SIZE / 2;
const INNER_R0 = 64;
const RING_GAP = 1.5;
const OUTER_PAD = 26;

function polar(r: number, a: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

export function YearHeatmap(props: Props) {
  const router = useRouter();
  const { users, tasks, days, anchorISO, mode } = props;

  const index = useMemo(
    () => buildCompletionIndex(props.completions),
    [props.completions],
  );

  const userTasks = useMemo(
    () =>
      users.map((u) => ({
        user: u,
        tasks: tasks.filter((t) => t.user_id === u.id),
      })),
    [users, tasks],
  );

  const [hover, setHover] = useState<{ iso: string; userId: string } | null>(
    null,
  );
  // Stable callback so the memoized <Segments> doesn't re-render on hover.
  const handleHover = useCallback(
    (iso: string, userId: string) => setHover({ iso, userId }),
    [],
  );
  const clearHover = useCallback(() => setHover(null), []);

  const N = Math.max(1, users.length);
  const outerMax = SIZE / 2 - OUTER_PAD;
  const ringWidth = (outerMax - INNER_R0) / N;
  const total = Math.max(1, days.length);
  const angleHalf = (Math.PI * 2) / total / 2;
  const startOffset = -Math.PI / 2;

  const sectorPath = (dayIndex: number, ringIndex: number) => {
    const a0 = (dayIndex / total) * Math.PI * 2 + startOffset + angleHalf * 0.4;
    const a1 =
      ((dayIndex + 1) / total) * Math.PI * 2 + startOffset - angleHalf * 0.4;
    const r0 = INNER_R0 + ringIndex * ringWidth;
    const r1 = r0 + ringWidth - RING_GAP;
    const [x1, y1] = polar(r1, a0);
    const [x2, y2] = polar(r1, a1);
    const [x3, y3] = polar(r0, a1);
    const [x4, y4] = polar(r0, a0);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r1.toFixed(2)},${r1.toFixed(
      2,
    )} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(
      2,
    )},${y3.toFixed(2)} A${r0.toFixed(2)},${r0.toFixed(2)} 0 ${large} 0 ${x4.toFixed(
      2,
    )},${y4.toFixed(2)} Z`;
  };

  const monthMarks: { i: number; label: string; angle: number }[] = [];
  for (let i = 0; i < days.length; i++) {
    const dt = parseISO(days[i]);
    if (dt.getDate() === 1) {
      monthMarks.push({
        i,
        label: format(dt, "MMM"),
        angle: ((i + 0.5) / total) * Math.PI * 2 + startOffset,
      });
    }
  }

  function go(anchor: string, m: WindowMode) {
    const p = new URLSearchParams({ date: anchor, mode: m });
    router.push(`/year?${p.toString()}`);
  }
  const shift = (n: number) => {
    const base = parseISO(anchorISO);
    const next = mode === "calendar" ? addYears(base, n) : addDays(base, n * 365);
    go(toISODate(next), mode);
  };

  return (
    <div className="space-y-4">
      {/* One-line header */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <h1 className="shrink-0 text-lg font-semibold tracking-tight">Year</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <ModeToggle
            mode={mode}
            onChange={(m) => go(anchorISO, m)}
            rollingLabel="Last 365"
            calendarLabel="Year"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => shift(-1)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="number"
              value={parseISO(anchorISO).getFullYear()}
              min={2000}
              max={2100}
              onChange={(e) => {
                const y = parseInt(e.target.value, 10);
                if (!Number.isNaN(y)) go(`${y}-01-01`, "calendar");
              }}
              className="h-9 w-20 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-center text-base outline-none focus:border-[var(--color-check)]"
            />
            <button
              onClick={() => shift(1)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center text-[var(--muted)]">
          No users yet — add some on the Daily page to see the yearly heatmap.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              role="img"
              aria-label="Yearly completion heatmap, one ring per user"
              className="mx-auto block h-auto w-full max-w-[560px]"
              onMouseLeave={clearHover}
            >
              <circle
                cx={CX}
                cy={CY}
                r={INNER_R0 - 6}
                fill="var(--card)"
                stroke="var(--border)"
              />

              {monthMarks.map((m, idx) => {
                const [x, y] = polar(outerMax + 14, m.angle);
                return (
                  <text
                    key={`m-${idx}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-[var(--muted)]"
                    style={{ fontSize: 11 }}
                  >
                    {m.label}
                  </text>
                );
              })}

              <Segments
                days={days}
                userTasks={userTasks}
                index={index}
                sectorPath={sectorPath}
                onHover={handleHover}
              />
            </svg>
          </div>

          <aside className="space-y-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
              <h3 className="mb-1 text-sm font-semibold">Rings (inner → outer)</h3>
              <ol className="space-y-0.5 text-sm">
                {userTasks.map(({ user }, i) => (
                  <li key={user.id} className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[var(--background)] text-[10px] font-semibold text-[var(--muted)]">
                      {i + 1}
                    </span>
                    {user.name}
                  </li>
                ))}
              </ol>
            </div>

            <HoverDetail hover={hover} userTasks={userTasks} index={index} />

            <ColorScale />
          </aside>
        </div>
      )}
    </div>
  );
}

/** Memoized so hovering a segment only re-renders the side panel, not the SVG. */
const Segments = memo(function Segments({
  days,
  userTasks,
  index,
  sectorPath,
  onHover,
}: {
  days: string[];
  userTasks: { user: User; tasks: Task[] }[];
  index: CompletionIndex;
  sectorPath: (dayIndex: number, ringIndex: number) => string;
  onHover: (iso: string, userId: string) => void;
}) {
  return (
    <>
      {days.map((iso, di) =>
        userTasks.map(({ user, tasks: ut }, ri) => {
          const score = scoreUserDate(ut, index, iso);
          return (
            <path
              key={`${iso}-${user.id}`}
              d={sectorPath(di, ri)}
              fill={percentColor(score.percent)}
              className="year-seg"
              onMouseEnter={() => onHover(iso, user.id)}
            >
              <title>
                {format(parseISO(iso), "EEE, MMM d, yyyy")} · {user.name}:{" "}
                {score.percent == null
                  ? "no data"
                  : `${Math.round(score.percent * 100)}%`}{" "}
                ({score.check}/{score.denominator})
              </title>
            </path>
          );
        }),
      )}
    </>
  );
});

function HoverDetail({
  hover,
  userTasks,
  index,
}: {
  hover: { iso: string; userId: string } | null;
  userTasks: { user: User; tasks: Task[] }[];
  index: CompletionIndex;
}) {
  if (!hover) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-3 text-sm text-[var(--muted)]">
        Hover any segment to see that day’s breakdown for everyone.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="mb-2 text-sm font-semibold">
        {format(parseISO(hover.iso), "EEE, MMM d, yyyy")}
      </div>
      <ul className="space-y-1 text-sm">
        {userTasks.map(({ user, tasks }) => {
          const s: Score = scoreUserDate(tasks, index, hover.iso);
          const pct = s.percent == null ? null : Math.round(s.percent * 100);
          const active = hover.userId === user.id;
          return (
            <li
              key={user.id}
              className={
                "flex items-center justify-between rounded px-1.5 py-0.5 " +
                (active ? "bg-black/[0.04]" : "")
              }
            >
              <span className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: percentColor(s.percent) }}
                />
                <span className={active ? "font-semibold" : ""}>{user.name}</span>
              </span>
              <span className="text-[var(--muted)]">
                {pct == null ? "—" : `${pct}%`}{" "}
                <span className="text-xs">
                  ({s.check}/{s.denominator})
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ColorScale() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
      <h3 className="mb-1 text-sm font-semibold">Completion</h3>
      <div className="flex items-center gap-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <span
            key={i}
            className="h-3 flex-1 rounded-sm"
            style={{ backgroundColor: percentColor(i / 10) }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <p className="mt-2 text-xs text-[var(--muted)]">
        Gray = no data. Exempt tasks are excluded from the score.
      </p>
    </div>
  );
}
