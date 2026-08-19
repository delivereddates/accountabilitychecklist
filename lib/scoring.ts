import type { CompletionStatus, Task, TaskCompletion } from "./types";

export interface Score {
  total: number; // all tasks considered
  check: number;
  noCheck: number; // explicitly marked missed
  exempt: number;
  noData: number; // no row recorded (or future day)
  /** check + noCheck + blanks-counted-as-missed once the day is graded (0 → "no data"). */
  denominator: number;
  /** check / denominator, or null when nothing was graded (-> "no data"). */
  percent: number | null;
}

/**
 * Roll up statuses into a Score.
 * - `undefined` / null  -> blank (no row). Blanks are never written to the DB,
 *   but once the day has a graded row (a check or an explicit miss) they count
 *   as missed in the score. A fully blank — or exempt-only — day is "no data".
 * - 'exempt'            -> excluded from the denominator.
 * - 'check' / 'no_check' -> graded.
 */
export function scoreFromStatuses(
  statuses: Iterable<CompletionStatus | undefined | null>,
): Score {
  let check = 0;
  let noCheck = 0;
  let exempt = 0;
  let noData = 0;
  let total = 0;
  for (const s of statuses) {
    total += 1;
    if (s === undefined || s === null) {
      noData += 1;
    } else if (s === "check") {
      check += 1;
    } else if (s === "exempt") {
      exempt += 1;
    } else {
      noCheck += 1;
    }
  }
  // Blank-counts-as-missed applies only once the day is graded at all;
  // otherwise an untouched day would score 0% instead of "no data".
  const graded = check + noCheck > 0;
  const denominator = graded ? total - exempt : 0;
  const percent = denominator > 0 ? check / denominator : null;
  return { total, check, noCheck, exempt, noData, denominator, percent };
}

/** Index completions by date -> taskId -> status for O(1) lookups. */
export interface CompletionIndex {
  byDate: Map<string, Map<string, CompletionStatus>>;
}

export function buildCompletionIndex(
  completions: TaskCompletion[],
): CompletionIndex {
  const byDate = new Map<string, Map<string, CompletionStatus>>();
  for (const c of completions) {
    let day = byDate.get(c.date);
    if (!day) {
      day = new Map();
      byDate.set(c.date, day);
    }
    day.set(c.task_id, c.status);
  }
  return { byDate };
}

/**
 * Status of a task on a date.
 * Returns `undefined` when no row exists (=> "no data"), which is distinct
 * from an explicit 'no_check'.
 */
export function getStatus(
  index: CompletionIndex,
  taskId: string,
  dateISO: string,
): CompletionStatus | undefined {
  return index.byDate.get(dateISO)?.get(taskId);
}

/** Tasks that existed on or before a date (created_at <= end of that day). */
export function tasksActiveOnDate(tasks: Task[], dateISO: string): Task[] {
  const end = new Date(`${dateISO}T23:59:59Z`).getTime();
  return tasks.filter((t) => new Date(t.created_at).getTime() <= end);
}

/** Score for a single user on a single date. */
export function scoreUserDate(
  userTasks: Task[],
  index: CompletionIndex,
  dateISO: string,
): Score {
  const active = tasksActiveOnDate(userTasks, dateISO);
  return scoreFromStatuses(active.map((t) => getStatus(index, t.id, dateISO)));
}

/**
 * Aggregate score across all users for a single date (month cells, week
 * headers). Composed from per-user scores so the blank-counts-as-missed rule
 * stays per person: your blanks only count once YOU have graded the day.
 */
export function scoreOverallDate(
  allTasks: Task[],
  index: CompletionIndex,
  dateISO: string,
): Score {
  const byUser = new Map<string, Task[]>();
  for (const t of tasksActiveOnDate(allTasks, dateISO)) {
    const list = byUser.get(t.user_id);
    if (list) list.push(t);
    else byUser.set(t.user_id, [t]);
  }
  let sum: Score | null = null;
  for (const userTasks of byUser.values()) {
    const s = scoreFromStatuses(
      userTasks.map((t) => getStatus(index, t.id, dateISO)),
    );
    sum = sum ? addScores(sum, s) : s;
  }
  return sum ?? scoreFromStatuses([]);
}

function addScores(a: Score, b: Score): Score {
  const denominator = a.denominator + b.denominator;
  const check = a.check + b.check;
  return {
    total: a.total + b.total,
    check,
    noCheck: a.noCheck + b.noCheck,
    exempt: a.exempt + b.exempt,
    noData: a.noData + b.noData,
    denominator,
    percent: denominator > 0 ? check / denominator : null,
  };
}
