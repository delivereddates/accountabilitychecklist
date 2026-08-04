"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isToday, isYesterday, parseISO } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn, toISODate } from "@/lib/utils";
import type { CompletionStatus, Task, TaskCompletion, User } from "@/lib/types";
import { scoreFromStatuses, tasksActiveOnDate, type Score } from "@/lib/scoring";
import { ThreeWayToggle } from "./ThreeWayToggle";

interface Props {
  users: User[];
  tasks: Task[];
  completions: TaskCompletion[];
  selectedDate: string;
  prevDate: string;
  todayISO: string;
}

const keyOf = (date: string, taskId: string) => `${date}::${taskId}`;

export function DailyEditor(props: Props) {
  const router = useRouter();
  const { selectedDate, prevDate } = props;

  const [users, setUsers] = useState<User[]>(props.users);
  const [tasks, setTasks] = useState<Task[]>(props.tasks);
  const [map, setMap] = useState<Map<string, CompletionStatus>>(() => {
    const m = new Map<string, CompletionStatus>();
    for (const c of props.completions) m.set(keyOf(c.date, c.task_id), c.status);
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");

  const statusOf = (dateISO: string, taskId: string): CompletionStatus =>
    map.get(keyOf(dateISO, taskId)) ?? "no_check";

  const scoreForUser = (userId: string, dateISO: string): Score => {
    const active = tasksActiveOnDate(
      tasks.filter((t) => t.user_id === userId),
      dateISO,
    );
    return scoreFromStatuses(active.map((t) => statusOf(dateISO, t.id)));
  };
  const scoreForAll = (dateISO: string): Score => {
    const active = tasksActiveOnDate(tasks, dateISO);
    return scoreFromStatuses(active.map((t) => statusOf(dateISO, t.id)));
  };

  // --- mutations -----------------------------------------------------------

  async function setStatus(
    dateISO: string,
    taskId: string,
    status: CompletionStatus,
  ) {
    const k = keyOf(dateISO, taskId);
    const prev = map.get(k) ?? "no_check";
    if (prev === status) return;
    setMap((m) => {
      const n = new Map(m);
      n.set(k, status);
      return n;
    });
    setError(null);
    try {
      const res = await fetch("/api/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, date: dateISO, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMap((m) => {
        const n = new Map(m);
        n.set(k, prev);
        return n;
      });
      setError("Couldn’t save that change — reverted.");
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    const name = newUserName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Couldn’t add user.");
      }
      const { user } = await res.json();
      setUsers((u) => [...u, user]);
      setNewUserName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t add user.");
    }
  }

  async function addTask(userId: string, title: string): Promise<boolean> {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, title }),
      });
      if (!res.ok) throw new Error();
      const { task } = await res.json();
      setTasks((t) => [...t, task]);
      return true;
    } catch {
      setError("Couldn’t add task.");
      return false;
    }
  }

  async function renameTask(taskId: string, title: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error();
      const { task } = await res.json();
      setTasks((ts) => ts.map((t) => (t.id === taskId ? task : t)));
      return true;
    } catch {
      setError("Couldn’t rename task.");
      return false;
    }
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Delete this task and all of its history?")) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTasks((ts) => ts.filter((t) => t.id !== taskId));
    } catch {
      setError("Couldn’t delete task.");
    }
  }

  // --- navigation ----------------------------------------------------------

  function goToDate(iso: string) {
    router.push(`/?date=${encodeURIComponent(iso)}`);
  }
  function shift(days: number) {
    goToDate(toISODate(addDays(parseISO(selectedDate), days)));
  }

  const selLabel = dateLabel(selectedDate);
  const prevLabel = dateLabel(prevDate);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[var(--color-nocheck-soft)] bg-[var(--color-nocheck-soft)] px-3 py-2 text-sm text-[var(--color-nocheck)]">
          {error}
        </div>
      )}

      {/* Header + date navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Daily Summary</h1>
          <p className="text-sm text-[var(--muted)]">
            Mark each task Check, Missed, or Exempt. Exempt never counts against
            you.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shift(-1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && goToDate(e.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-sm outline-none focus:border-[var(--color-check)]"
          />
          <button
            onClick={() => shift(1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => goToDate(props.todayISO)}
            className="ml-1 h-9 rounded-lg border border-[var(--border)] px-3 text-sm font-medium hover:bg-black/5"
          >
            Today
          </button>
        </div>
      </div>

      {/* Day-level score chips */}
      <div className="flex flex-wrap items-center gap-2">
        <DayScoreChip
          label={selLabel}
          score={scoreForAll(selectedDate)}
        />
        <span className="text-[var(--muted)]">vs</span>
        <DayScoreChip
          label={prevLabel}
          score={scoreForAll(prevDate)}
          muted
        />
      </div>

      {/* User cards */}
      {users.length === 0 ? (
        <EmptyState
          value={newUserName}
          onChange={setNewUserName}
          onSubmit={addUser}
        />
      ) : (
        <div className="grid gap-4">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              tasks={tasks.filter((t) => t.user_id === u.id)}
              selectedDate={selectedDate}
              prevDate={prevDate}
              selLabel={selLabel}
              prevLabel={prevLabel}
              statusOf={statusOf}
              scoreForDate={(d) => scoreForUser(u.id, d)}
              onSetStatus={setStatus}
              onRenameTask={renameTask}
              onDeleteTask={deleteTask}
              onAddTask={(title) => addTask(u.id, title)}
            />
          ))}

          <AddUserForm
            value={newUserName}
            onChange={setNewUserName}
            onSubmit={addUser}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (module scope so they keep state across parent re-renders)
// ---------------------------------------------------------------------------

interface DateLabel {
  primary: string;
  secondary: string;
}

function dateLabel(iso: string): DateLabel {
  const d = parseISO(iso);
  if (isToday(d)) return { primary: "Today", secondary: format(d, "MMM d") };
  if (isYesterday(d))
    return { primary: "Yesterday", secondary: format(d, "MMM d") };
  return { primary: format(d, "EEE"), secondary: format(d, "MMM d") };
}

function DayScoreChip({
  label,
  score,
  muted,
}: {
  label: DateLabel;
  score: Score;
  muted?: boolean;
}) {
  const pct = score.percent == null ? null : Math.round(score.percent * 100);
  const color =
    pct == null
      ? "var(--muted)"
      : pct >= 100
        ? "var(--color-check)"
        : pct >= 50
          ? "var(--color-exempt)"
          : "var(--color-nocheck)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
        muted && "opacity-90",
      )}
      style={{ borderColor: "color-mix(in srgb, " + color + " 35%, transparent)" }}
    >
      <span>
        <span className="font-semibold">{label.primary}</span>{" "}
        <span className="text-[var(--muted)]">{label.secondary}</span>
      </span>
      <span className="font-semibold" style={{ color }}>
        {pct == null ? "—" : `${pct}%`}
      </span>
      <span className="text-xs text-[var(--muted)]">
        {score.check}/{score.denominator}
      </span>
    </span>
  );
}

function UserCard({
  user,
  tasks,
  selectedDate,
  prevDate,
  selLabel,
  prevLabel,
  statusOf,
  scoreForDate,
  onSetStatus,
  onRenameTask,
  onDeleteTask,
  onAddTask,
}: {
  user: User;
  tasks: Task[];
  selectedDate: string;
  prevDate: string;
  selLabel: DateLabel;
  prevLabel: DateLabel;
  statusOf: (dateISO: string, taskId: string) => CompletionStatus;
  scoreForDate: (dateISO: string) => Score;
  onSetStatus: (dateISO: string, taskId: string, status: CompletionStatus) => void;
  onRenameTask: (taskId: string, title: string) => Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (title: string) => Promise<boolean>;
}) {
  const selScore = scoreForDate(selectedDate);
  const prevScore = scoreForDate(prevDate);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{user.name}</h2>
        <div className="flex items-center gap-1.5">
          <MiniScore label={selLabel.primary} score={selScore} />
          <MiniScore label={prevLabel.primary} score={prevScore} />
        </div>
      </header>

      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-[var(--muted)]">
          No tasks yet for {user.name}.
        </p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              selectedDate={selectedDate}
              prevDate={prevDate}
              selLabel={selLabel}
              prevLabel={prevLabel}
              selStatus={statusOf(selectedDate, task.id)}
              prevStatus={statusOf(prevDate, task.id)}
              onSetStatus={onSetStatus}
              onRename={onRenameTask}
              onDelete={onDeleteTask}
            />
          ))}
        </ul>
      )}

      <AddTaskForm onAdd={onAddTask} />
    </section>
  );
}

function MiniScore({ label, score }: { label: string; score: Score }) {
  const pct = score.percent == null ? null : Math.round(score.percent * 100);
  const color =
    pct == null
      ? "var(--muted)"
      : pct >= 100
        ? "var(--color-check)"
        : pct >= 50
          ? "var(--color-exempt)"
          : "var(--color-nocheck)";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
      style={{
        color,
        borderColor: "color-mix(in srgb, " + color + " 35%, transparent)",
      }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{pct == null ? "—" : `${pct}%`}</span>
    </span>
  );
}

function TaskRow({
  task,
  selectedDate,
  prevDate,
  selLabel,
  prevLabel,
  selStatus,
  prevStatus,
  onSetStatus,
  onRename,
  onDelete,
}: {
  task: Task;
  selectedDate: string;
  prevDate: string;
  selLabel: DateLabel;
  prevLabel: DateLabel;
  selStatus: CompletionStatus;
  prevStatus: CompletionStatus;
  onSetStatus: (dateISO: string, taskId: string, status: CompletionStatus) => void;
  onRename: (taskId: string, title: string) => Promise<boolean>;
  onDelete: (taskId: string) => void;
}) {
  const activeSel = tasksActiveOnDate([task], selectedDate).length > 0;
  const activePrev = tasksActiveOnDate([task], prevDate).length > 0;

  return (
    <li className="group flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] py-2.5 first:border-t-0">
      <div className="flex min-w-[9rem] flex-1 items-center gap-2">
        <TaskTitle title={task.title} onRename={(t) => onRename(task.id, t)} />
        <button
          onClick={() => onDelete(task.id)}
          className="rounded p-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--color-nocheck)] group-hover:opacity-100"
          aria-label="Delete task"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <LabeledToggle
        label={`${selLabel.primary} · ${selLabel.secondary}`}
        active={activeSel}
        status={selStatus}
        onChange={(s) => onSetStatus(selectedDate, task.id, s)}
      />
      <LabeledToggle
        label={`${prevLabel.primary} · ${prevLabel.secondary}`}
        active={activePrev}
        status={prevStatus}
        onChange={(s) => onSetStatus(prevDate, task.id, s)}
      />
    </li>
  );
}

function LabeledToggle({
  label,
  active,
  status,
  onChange,
}: {
  label: string;
  active: boolean;
  status: CompletionStatus;
  onChange: (status: CompletionStatus) => void;
}) {
  if (!active) {
    return (
      <div className="flex min-w-[7rem] flex-col gap-0.5 opacity-40">
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          {label}
        </span>
        <span className="h-7 text-xs text-[var(--muted)]">—</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-[7rem] flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <ThreeWayToggle value={status} onChange={onChange} size="sm" />
    </div>
  );
}

function TaskTitle({
  title,
  onRename,
}: {
  title: string;
  onRename: (title: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={async () => {
          const v = draft.trim();
          if (v && v !== title && (await onRename(v))) {
            setEditing(false);
          } else {
            setDraft(title);
            setEditing(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="min-w-0 flex-1 rounded border border-[var(--color-check)] px-1.5 py-0.5 text-sm outline-none"
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-sm">{title}</span>
      <button
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        className="rounded p-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--foreground)] group-hover:opacity-100"
        aria-label="Rename task"
        title="Rename task"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function AddTaskForm({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = title.trim();
    if (!v) return;
    setBusy(true);
    const ok = await onAdd(v);
    setBusy(false);
    if (ok) setTitle("");
  }

  return (
    <form onSubmit={submit} className="mt-2 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-sm outline-none focus:border-[var(--color-check)]"
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--color-check)] px-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Add
      </button>
    </form>
  );
}

function AddUserForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)]/50 p-3"
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a new user (e.g. Oliver)…"
        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--color-check)]"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Add user
      </button>
    </form>
  );
}

function EmptyState({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-check-soft)]">
        <Inbox className="h-6 w-6 text-[var(--color-check)]" />
      </div>
      <div>
        <h2 className="text-base font-semibold">No users yet</h2>
        <p className="text-sm text-[var(--muted)]">
          Add the first person to start tracking daily tasks.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex w-full max-w-sm items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="User name (e.g. Oliver)"
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--color-check)]"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}
