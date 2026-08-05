"use client";

import { useMemo, useState } from "react";
import { addDays, format, isToday, isYesterday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { toISODate } from "@/lib/utils";
import type { CompletionStatus, Task, User } from "@/lib/types";
import {
  buildCompletionIndex,
  getStatus,
  scoreFromStatuses,
  tasksActiveOnDate,
  type Score,
} from "@/lib/scoring";
import { percentColor } from "@/lib/colors";
import type { DashboardData } from "@/lib/use-dashboard";
import { useMutations } from "@/lib/swr-mutations";
import { ThreeWayToggle } from "./ThreeWayToggle";

type Mutations = ReturnType<typeof useMutations>;

interface Props {
  data: DashboardData;
  mutations: Mutations;
  selectedDate: string;
  todayISO: string;
}

export function DailyEditor({ data, mutations, selectedDate, todayISO }: Props) {
  const [date, setDate] = useState(selectedDate);
  const [error, setError] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");

  const index = useMemo(
    () => buildCompletionIndex(data.completions),
    [data.completions],
  );
  const { users, tasks } = data;

  const statusOf = (d: string, tid: string) => getStatus(index, tid, d);
  const scoreForUser = (userId: string, d: string): Score =>
    scoreFromStatuses(
      tasksActiveOnDate(
        tasks.filter((t) => t.user_id === userId),
        d,
      ).map((t) => statusOf(d, t.id)),
    );
  const scoreForAll = (d: string): Score =>
    scoreFromStatuses(
      tasksActiveOnDate(tasks, d).map((t) => statusOf(d, t.id)),
    );

  function handleSetStatus(d: string, taskId: string, s: CompletionStatus | null) {
    setError(null);
    const p = s === null ? mutations.clearCompletion(taskId, d) : mutations.setCompletion(taskId, d, s);
    p.catch(() => setError("Couldn’t save that — reverted."));
  }
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    const name = newUserName.trim();
    if (!name) return;
    try {
      await mutations.addUser(name);
      setNewUserName("");
    } catch {
      setError("Couldn’t add user.");
    }
  }
  function handleAddTask(userId: string, title: string) {
    return mutations
      .addTask(userId, title)
      .then(() => true)
      .catch(() => {
        setError("Couldn’t add task.");
        return false;
      });
  }
  function handleRename(taskId: string, title: string) {
    return mutations
      .renameTask(taskId, title)
      .then(() => true)
      .catch(() => {
        setError("Couldn’t rename.");
        return false;
      });
  }
  function handleDeleteTask(taskId: string) {
    if (!window.confirm("Delete this task and all of its history?")) return;
    mutations.deleteTask(taskId).catch(() => setError("Couldn’t delete."));
  }
  function handleDeleteUser(userId: string, name: string) {
    if (
      !window.confirm(
        `Delete ${name} and ALL their tasks and history? This cannot be undone.`,
      )
    )
      return;
    mutations.deleteUser(userId).catch(() => setError("Couldn’t delete user."));
  }

  function shift(days: number) {
    setDate(toISODate(addDays(parseISO(date), days)));
  }

  const overall = scoreForAll(date);
  const overallPct =
    overall.percent == null ? null : Math.round(overall.percent * 100);
  const overallColor = percentColor(overall.percent);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-[var(--color-nocheck-soft)] bg-[var(--color-nocheck-soft)] px-3 py-2 text-sm text-[var(--color-nocheck)]">
          {error}
        </div>
      )}

      {/* One-line header: date nav + overall % */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <h1 className="shrink-0 text-lg font-semibold tracking-tight">Daily</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => shift(-1)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 text-base outline-none focus:border-[var(--color-check)]"
          />
          <button
            onClick={() => shift(1)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] hover:bg-black/5"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDate(todayISO)}
            className="h-9 shrink-0 rounded-lg border border-[var(--border)] px-3 text-base font-medium hover:bg-black/5"
          >
            Today
          </button>
          <span
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm"
            style={{
              borderColor: `color-mix(in srgb, ${overallColor} 40%, transparent)`,
            }}
            title="Overall completion for this day"
          >
            <span className="font-semibold" style={{ color: overallColor }}>
              {overallPct == null ? "—" : `${overallPct}%`}
            </span>
            <span className="text-xs text-[var(--muted)]">
              {overall.check}/{overall.denominator}
            </span>
          </span>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState
          value={newUserName}
          onChange={setNewUserName}
          onSubmit={handleAddUser}
        />
      ) : (
        <div className="grid gap-4">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              tasks={tasks.filter((t) => t.user_id === u.id)}
              selectedDate={date}
              statusOf={statusOf}
              score={() => scoreForUser(u.id, date)}
              onSetStatus={handleSetStatus}
              onRenameTask={handleRename}
              onDeleteTask={handleDeleteTask}
              onAddTask={(title) => handleAddTask(u.id, title)}
              onDeleteUser={() => handleDeleteUser(u.id, u.name)}
            />
          ))}
          <AddUserForm
            value={newUserName}
            onChange={setNewUserName}
            onSubmit={handleAddUser}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (module scope so they keep state across parent re-renders)
// ---------------------------------------------------------------------------

function shortDateLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yest.";
  return format(d, "EEE");
}

function UserCard({
  user,
  tasks,
  selectedDate,
  statusOf,
  score,
  onSetStatus,
  onRenameTask,
  onDeleteTask,
  onAddTask,
  onDeleteUser,
}: {
  user: User;
  tasks: Task[];
  selectedDate: string;
  statusOf: (dateISO: string, taskId: string) => CompletionStatus | undefined;
  score: () => Score;
  onSetStatus: (
    dateISO: string,
    taskId: string,
    status: CompletionStatus | null,
  ) => void;
  onRenameTask: (taskId: string, title: string) => Promise<boolean>;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (title: string) => Promise<boolean>;
  onDeleteUser: () => void;
}) {
  const s = score();
  const pct = s.percent == null ? null : Math.round(s.percent * 100);

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <header className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 className="text-base font-semibold">{user.name}</h2>
          <button
            onClick={onDeleteUser}
            title={`Delete ${user.name}`}
            aria-label={`Delete ${user.name}`}
            className="rounded p-1 text-[var(--muted)] opacity-50 transition hover:text-[var(--color-nocheck)] hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <MiniScore label={shortDateLabel(selectedDate)} score={s} pct={pct} />
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
              status={statusOf(selectedDate, task.id)}
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

function MiniScore({
  label,
  score,
  pct,
}: {
  label: string;
  score: Score;
  pct: number | null;
}) {
  const color = percentColor(score.percent);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
      style={{
        color: score.percent == null ? "var(--muted)" : color,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
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
  status,
  onSetStatus,
  onRename,
  onDelete,
}: {
  task: Task;
  selectedDate: string;
  status: CompletionStatus | undefined;
  onSetStatus: (
    dateISO: string,
    taskId: string,
    status: CompletionStatus | null,
  ) => void;
  onRename: (taskId: string, title: string) => Promise<boolean>;
  onDelete: (taskId: string) => void;
}) {
  const active = tasksActiveOnDate([task], selectedDate).length > 0;

  return (
    <li className="group flex items-center gap-2 border-t border-[var(--border)] py-2.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <TaskTitle title={task.title} onRename={(t) => onRename(task.id, t)} />
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 rounded p-1 text-[var(--muted)] opacity-50 transition hover:text-[var(--color-nocheck)] hover:opacity-100"
          aria-label="Delete task"
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {active ? (
        <ThreeWayToggle
          value={status ?? null}
          onChange={(s) => onSetStatus(selectedDate, task.id, s)}
          size="sm"
        />
      ) : (
        <span className="shrink-0 pr-2 text-xs text-[var(--muted)] opacity-40">
          —
        </span>
      )}
    </li>
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
        className="min-w-0 flex-1 rounded border border-[var(--color-check)] px-1.5 py-0.5 text-base outline-none"
      />
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <button
        onClick={() => {
          setDraft(title);
          setEditing(true);
        }}
        className="rounded p-1 text-[var(--muted)] opacity-50 transition hover:text-[var(--foreground)] hover:opacity-100"
        aria-label="Rename task"
        title="Rename task"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <span className="truncate text-sm">{title}</span>
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
        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 text-base outline-none focus:border-[var(--color-check)]"
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[var(--color-check)] px-2.5 text-sm font-medium text-white disabled:opacity-50"
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
        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-base outline-none focus:border-[var(--color-check)]"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[var(--color-check)] px-3 text-sm font-semibold text-white disabled:opacity-50"
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
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-base outline-none focus:border-[var(--color-check)]"
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
