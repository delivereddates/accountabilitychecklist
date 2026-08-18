"use client";

import { useMemo, useState } from "react";
import { addDays, format, isToday, isYesterday, parseISO } from "date-fns";
import { Inbox, Pencil, Plus, Trash2 } from "lucide-react";
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
import { DateStepper } from "@/components/summary/DateStepper";

type Mutations = ReturnType<typeof useMutations>;

interface Props {
  data: DashboardData;
  mutations: Mutations;
  selectedDate: string;
}

export function DailyEditor({ data, mutations, selectedDate }: Props) {
  const [date, setDate] = useState(selectedDate);
  const [error, setError] = useState<string | null>(null);

  const index = useMemo(
    () => buildCompletionIndex(data.completions),
    [data.completions],
  );
  const noteIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of data.notes) m.set(`${n.task_id}|${n.date}`, n.note);
    return m;
  }, [data.notes]);
  const { users, tasks } = data;

  const statusOf = (d: string, tid: string) => getStatus(index, tid, d);
  const noteFor = (taskId: string, d: string) =>
    noteIndex.get(`${taskId}|${d}`) ?? "";
  const scoreForUser = (userId: string, d: string): Score =>
    scoreFromStatuses(
      tasksActiveOnDate(
        tasks.filter((t) => t.user_id === userId),
        d,
      ).map((t) => statusOf(d, t.id)),
    );

  function handleSetStatus(d: string, taskId: string, s: CompletionStatus | null) {
    setError(null);
    if (s === null) mutations.clearCompletion(taskId, d);
    else mutations.setCompletion(taskId, d, s);
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
  function handleRenameTask(taskId: string, title: string) {
    return mutations
      .updateTask(taskId, title)
      .then(() => true)
      .catch(() => {
        setError("Couldn’t save task.");
        return false;
      });
  }
  function handleSetNote(taskId: string, d: string, note: string) {
    setError(null);
    mutations.setTaskNote(taskId, d, note).catch(() => setError("Couldn’t save note."));
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-[var(--color-nocheck-soft)] bg-[var(--color-nocheck-soft)] px-3 py-2 text-sm text-[var(--color-nocheck)]">
          {error}
        </div>
      )}

      {/* One-line header: date stepper (no Today button, no overall %) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <h1 className="shrink-0 text-lg font-semibold tracking-tight">Daily</h1>
        <div className="ml-auto">
          <DateStepper
            value={date}
            onChange={setDate}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
          />
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              tasks={tasks.filter((t) => t.user_id === u.id)}
              selectedDate={date}
              statusOf={statusOf}
              noteFor={noteFor}
              score={() => scoreForUser(u.id, date)}
              onSetStatus={handleSetStatus}
              onRenameTask={handleRenameTask}
              onSetNote={handleSetNote}
              onDeleteTask={handleDeleteTask}
              onAddTask={(title) => handleAddTask(u.id, title)}
              onDeleteUser={() => handleDeleteUser(u.id, u.name)}
            />
          ))}
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
  noteFor,
  score,
  onSetStatus,
  onRenameTask,
  onSetNote,
  onDeleteTask,
  onAddTask,
  onDeleteUser,
}: {
  user: User;
  tasks: Task[];
  selectedDate: string;
  statusOf: (dateISO: string, taskId: string) => CompletionStatus | undefined;
  noteFor: (taskId: string, dateISO: string) => string;
  score: () => Score;
  onSetStatus: (
    dateISO: string,
    taskId: string,
    status: CompletionStatus | null,
  ) => void;
  onRenameTask: (taskId: string, title: string) => Promise<boolean>;
  onSetNote: (taskId: string, dateISO: string, note: string) => void;
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
              note={noteFor(task.id, selectedDate)}
              onSetStatus={onSetStatus}
              onRename={onRenameTask}
              onSetNote={onSetNote}
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
  note,
  onSetStatus,
  onRename,
  onSetNote,
  onDelete,
}: {
  task: Task;
  selectedDate: string;
  status: CompletionStatus | undefined;
  note: string;
  onSetStatus: (
    dateISO: string,
    taskId: string,
    status: CompletionStatus | null,
  ) => void;
  onRename: (taskId: string, title: string) => Promise<boolean>;
  onSetNote: (taskId: string, dateISO: string, note: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const active = tasksActiveOnDate([task], selectedDate).length > 0;
  const [showNotes, setShowNotes] = useState(false);
  const hasNotes = !!note?.trim();

  return (
    <li className="flex flex-col gap-1 border-t border-[var(--border)] py-2.5 first:border-t-0">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <TaskTitle title={task.title} onRename={(t) => onRename(task.id, t)} />
          <button
            onClick={() => setShowNotes((v) => !v)}
            className={
              "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium transition " +
              (hasNotes
                ? "text-[var(--color-exempt)]"
                : "text-[var(--muted)] opacity-60 hover:opacity-100")
            }
            title="Notes"
          >
            Notes{hasNotes ? " •" : ""}
          </button>
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
      </div>
      {showNotes && (
        <TaskNotes
          key={`${task.id}|${selectedDate}`}
          note={note}
          onSave={(v) => onSetNote(task.id, selectedDate, v)}
        />
      )}
    </li>
  );
}

function TaskNotes({
  note,
  onSave,
}: {
  note: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(note);
  return (
    <textarea
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (v !== note) onSave(v);
      }}
      placeholder="Notes for this day…"
      rows={2}
      className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm outline-none focus:border-[var(--color-check)]"
    />
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
          const val = draft.trim();
          if (val && val !== title && (await onRename(val))) {
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
    const val = title.trim();
    if (!val) return;
    setBusy(true);
    const ok = await onAdd(val);
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-check-soft)]">
        <Inbox className="h-6 w-6 text-[var(--color-check)]" />
      </div>
      <div>
        <h2 className="text-base font-semibold">No users yet</h2>
        <p className="text-sm text-[var(--muted)]">
          Accounts are configured by the administrator — each person appears
          here automatically after their first login.
        </p>
      </div>
    </div>
  );
}
