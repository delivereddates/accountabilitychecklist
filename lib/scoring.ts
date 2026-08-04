import type { CompletionStatus, Task, TaskCompletion } from "./types";

export interface Score {
  total: number; // all tasks considered
  check: number;
  noCheck: number;
  exempt: number;
  denominator: number; // total - exempt (exempt never penalises the score)
  /** check / denominator, or null when there is nothing checkable (→ "no data"). */
  percent: number | null;
}

/** Roll up a list of statuses into a Score (excluded exempt from denominator). */
export function scoreFromStatuses(statuses: Iterable<CompletionStatus>): Score {
  let check = 0;
  let noCheck = 0;
  let exempt = 0;
  let total = 0;
  for (const s of statuses) {
    total += 1;
    if (s === "check") check += 1;
    else if (s === "exempt") exempt += 1;
    else noCheck += 1;
  }
  const denominator = total - exempt;
  const percent = denominator > 0 ? check / denominator : null;
  return { total, check, noCheck, exempt, denominator, percent };
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

/** Status of a task on a date; absence of a row means 'no_check'. */
export function getStatus(
  index: CompletionIndex,
  taskId: string,
  dateISO: string,
): CompletionStatus {
  return index.byDate.get(dateISO)?.get(taskId) ?? "no_check";
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
  return scoreFromStatuses(
    active.map((t) => getStatus(index, t.id, dateISO)),
  );
}

/** Aggregate score across all users for a single date (month calendar cells). */
export function scoreOverallDate(
  allTasks: Task[],
  index: CompletionIndex,
  dateISO: string,
): Score {
  const active = tasksActiveOnDate(allTasks, dateISO);
  return scoreFromStatuses(
    active.map((t) => getStatus(index, t.id, dateISO)),
  );
}
