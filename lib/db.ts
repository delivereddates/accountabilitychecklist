import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAppUsers } from "./app-users";
import type {
  CompletionStatus,
  PushSubscriptionRow,
  Task,
  TaskCompletion,
  TaskNote,
  User,
  UserSettings,
} from "./types";
import type { SyncChanges, SyncPullResponse } from "./local/types";

let _client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the SERVICE ROLE key, which bypasses RLS.
 * NEVER import this module from a Client Component — the `server-only` guard
 * throws at build time if you try.
 */
function admin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase server env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getUsers(): Promise<User[]> {
  const { data, error } = await admin()
    .from("users")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function getTasks(): Promise<Task[]> {
  const { data, error } = await admin()
    .from("tasks")
    .select("id, user_id, title, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Task[];
}

/**
 * Tasks belonging to APP_USERS accounts only (joined via the configured user
 * list). Tasks of hidden users stay in the DB, untouched.
 */
export async function getConfiguredTasks(): Promise<Task[]> {
  const users = await getConfiguredUsers();
  const ids = new Set(users.map((u) => u.id));
  const tasks = await getTasks();
  return tasks.filter((t) => ids.has(t.user_id));
}

export async function getTaskNotes(): Promise<TaskNote[]> {
  const { data, error } = await admin()
    .from("task_notes")
    .select("id, task_id, date, note");
  if (error) throw error;
  return (data ?? []) as TaskNote[];
}

export async function getCompletions(
  fromISO: string,
  toISO: string,
): Promise<TaskCompletion[]> {
  const { data, error } = await admin()
    .from("task_completions")
    .select("id, task_id, date, status")
    .gte("date", fromISO)
    .lte("date", toISO);
  if (error) throw error;
  return (data ?? []) as TaskCompletion[];
}

/** All completion rows (full history) — one query to warm the client cache. */
export async function getAllCompletions(): Promise<TaskCompletion[]> {
  const { data, error } = await admin()
    .from("task_completions")
    .select("id, task_id, date, status");
  if (error) throw error;
  return (data ?? []) as TaskCompletion[];
}

/** Everything a summary page needs for a [from, to] date range, in parallel. */
export async function getDashboardData(fromISO: string, toISO: string) {
  const [users, tasks, completions] = await Promise.all([
    getConfiguredUsers(),
    getConfiguredTasks(),
    getCompletions(fromISO, toISO),
  ]);
  return { users, tasks, completions };
}

/**
 * Full dataset for the client cache — APP_USERS accounts only. Completions
 * and notes of hidden users are filtered client-side-invisible: they'd key
 * to task ids that no longer appear, so they simply never match.
 */
export async function getDashboardAll() {
  const [users, tasks, completions, notes] = await Promise.all([
    getConfiguredUsers(),
    getConfiguredTasks(),
    getAllCompletions(),
    getTaskNotes(),
  ]);
  return { users, tasks, completions, notes };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createUser(name: string): Promise<User> {
  const { data, error } = await admin()
    .from("users")
    .insert({ name: name.trim() })
    .select("id, name, created_at")
    .single();
  if (error) throw error;
  return data as User;
}

/**
 * Accounts live in the APP_USERS env var, not the DB — they map to a users
 * row by display name. Return the row, creating it on the account's first
 * login (the two-step insert handles the unique-name race by refetching).
 */
export async function getOrCreateUserByName(name: string): Promise<User> {
  const trimmed = name.trim();
  const existing = await getUserByName(trimmed);
  if (existing) return existing;
  const { data, error } = await admin()
    .from("users")
    .insert({ name: trimmed })
    .select("id, name, created_at")
    .maybeSingle();
  if (error || !data) {
    // Lost a race (or transient error) — the row should exist now.
    const retry = await getUserByName(trimmed);
    if (retry) return retry;
    throw error ?? new Error("Failed to create user");
  }
  return data as User;
}

export async function getUserByName(name: string): Promise<User | null> {
  const { data, error } = await admin()
    .from("users")
    .select("id, name, created_at")
    .eq("name", name.trim())
    .maybeSingle();
  if (error) throw error;
  return (data as User) ?? null;
}

/**
 * Users visible to the app: one row per APP_USERS account, in configured
 * order. A missing row is provisioned here (same auto-create login does),
 * so a newly added person shows up immediately with a blank slate — and
 * rows are never deleted: removing an account simply drops them from this
 * list (permanent deletion is a manual SQL operation by the admin). Falls
 * back to all rows when APP_USERS can't be read, so a config error hides
 * data rather than serving the wrong list.
 */
export async function getConfiguredUsers(): Promise<User[]> {
  let names: string[] | null = null;
  try {
    // Dedupe by trimmed name, preserving APP_USERS order; skip blanks.
    names = [
      ...new Set(
        getAppUsers()
          .map((a) => a.name.trim())
          .filter(Boolean),
      ),
    ];
  } catch {
    names = null;
  }
  const rows = await getUsers();
  if (!names || names.length === 0) return rows;

  const byName = new Map(rows.map((r) => [r.name, r]));
  const users: User[] = [];
  for (const n of names) {
    const existing = byName.get(n);
    if (existing) {
      users.push(existing);
    } else {
      // Provision the row (idempotent, race-safe). A transient failure skips
      // the person for this read rather than blanking the whole page.
      try {
        users.push(await getOrCreateUserByName(n));
      } catch {
        // ignore — retried on the next read
      }
    }
  }
  return users;
}

export async function createTask(userId: string, title: string): Promise<Task> {
  const { data, error } = await admin()
    .from("tasks")
    .insert({ user_id: userId, title: title.trim() })
    .select("id, user_id, title, created_at")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await admin()
    .from("tasks")
    .select("id, user_id, title, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Task) ?? null;
}

export async function updateTask(id: string, title: string): Promise<Task> {
  const { data, error } = await admin()
    .from("tasks")
    .update({ title: title.trim() })
    .eq("id", id)
    .select("id, user_id, title, created_at")
    .single();
  if (error) throw error;
  return data as Task;
}

/** Upsert a per-task-per-day note (UNIQUE(task_id, date)). */
export async function upsertTaskNote(
  taskId: string,
  dateISO: string,
  note: string,
): Promise<TaskNote> {
  const { data, error } = await admin()
    .from("task_notes")
    .upsert({ task_id: taskId, date: dateISO, note }, { onConflict: "task_id,date" })
    .select("id, task_id, date, note")
    .single();
  if (error) throw error;
  return data as TaskNote;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await admin().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

/** Upsert the status of one task on one date (UNIQUE(task_id, date)). */
export async function setCompletion(
  taskId: string,
  dateISO: string,
  status: CompletionStatus,
): Promise<TaskCompletion> {
  const { data, error } = await admin()
    .from("task_completions")
    .upsert(
      { task_id: taskId, date: dateISO, status },
      { onConflict: "task_id,date" },
    )
    .select("id, task_id, date, status")
    .single();
  if (error) throw error;
  return data as TaskCompletion;
}

/** Remove a day's row for a task, returning it to "no data". */
export async function clearCompletion(
  taskId: string,
  dateISO: string,
): Promise<void> {
  const { error } = await admin()
    .from("task_completions")
    .delete()
    .eq("task_id", taskId)
    .eq("date", dateISO);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Settings + push (rows are created lazily; a missing user_settings row means
// "all notifications off" — the safe default).
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS: UserSettings = {
  notify_11: false,
  notify_17: false,
  notify_21: false,
  timezone: null,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await admin()
    .from("user_settings")
    .select("user_id, notify_11, notify_17, notify_21, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_SETTINGS };
  return {
    notify_11: data.notify_11,
    notify_17: data.notify_17,
    notify_21: data.notify_21,
    timezone: data.timezone ?? null,
  };
}

export async function updateUserSettings(
  userId: string,
  patch: Partial<Omit<UserSettings, "timezone">> & { timezone?: string | null },
): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const next: UserSettings & { user_id: string } = {
    user_id: userId,
    ...current,
    ...patch,
  };
  const { data, error } = await admin()
    .from("user_settings")
    .upsert(next, { onConflict: "user_id" })
    .select("user_id, notify_11, notify_17, notify_21, timezone")
    .single();
  if (error) throw error;
  return {
    notify_11: data.notify_11,
    notify_17: data.notify_17,
    notify_21: data.notify_21,
    timezone: data.timezone ?? null,
  };
}

/** Settings rows with at least one notification enabled (for the cron run). */
export async function getActiveNotificationSettings(): Promise<
  (UserSettings & { user_id: string })[]
> {
  const { data, error } = await admin()
    .from("user_settings")
    .select("user_id, notify_11, notify_17, notify_21, timezone")
    .or("notify_11.eq.true,notify_17.eq.true,notify_21.eq.true")
    .not("timezone", "is", null);
  if (error) throw error;
  return (data ?? []).map((s: Record<string, unknown>) => ({
    user_id: s.user_id as string,
    notify_11: s.notify_11 as boolean,
    notify_17: s.notify_17 as boolean,
    notify_21: s.notify_21 as boolean,
    timezone: s.timezone as string,
  }));
}

export async function countPushSubscriptions(userId: string): Promise<number> {
  const { count, error } = await admin()
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function getPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const { data, error } = await admin()
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as PushSubscriptionRow[];
}

/** Upsert by endpoint — re-subscribing a shared browser reassigns it to the
 * currently logged-in user. */
export async function upsertPushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<void> {
  const { error } = await admin()
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
      { onConflict: "endpoint" },
    );
  if (error) throw error;
}

export async function deletePushSubscription(
  endpoint: string,
  userId: string,
): Promise<void> {
  const { error } = await admin()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Remove EVERY subscription row on the account (the "Unsubscribe" button —
 * also clears orphans left by devices destroyed without unsubscribing). */
export async function deleteAllPushSubscriptions(
  userId: string,
): Promise<void> {
  const { error } = await admin()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const { error } = await admin()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (error) throw error;
}

/**
 * Claim a (user, local date, slot) notification — insert-on-conflict-do-
 * nothing, returning the row only for the caller that won the race. This
 * dedupes overlapping scheduler runs.
 */
export async function claimPushLog(
  userId: string,
  date: string,
  hour: 11 | 17 | 21,
): Promise<string | null> {
  const { data, error } = await admin()
    .from("push_log")
    .upsert(
      { user_id: userId, date, hour },
      { onConflict: "user_id,date,hour", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function markPushLogSent(id: string): Promise<void> {
  const { error } = await admin()
    .from("push_log")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Delete a claim row so the next scheduler run can retry that slot. */
export async function releasePushLog(id: string): Promise<void> {
  const { error } = await admin().from("push_log").delete().eq("id", id);
  if (error) throw error;
}

export async function deletePushLogOlderThanDays(days: number): Promise<void> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { error } = await admin()
    .from("push_log")
    .delete()
    .lt("date", cutoff);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Local-first sync (productivity sections: todos / calendar / notes)
//
// These tables mirror lib/local/types.ts records. Upserts are last-write-wins
// per row (strictly newer client updated_at wins), enforced inside the
// sync_push_records RPC because supabase-js upsert() cannot express a
// conditional update.
// ---------------------------------------------------------------------------

/** Apply one push batch via the LWW RPC (see supabase/local-first.sql). */
export async function pushLocalRecords(
  userId: string,
  changes: SyncChanges,
): Promise<void> {
  const { error } = await admin().rpc("sync_push_records", {
    p_user_id: userId,
    p_todos: changes.todos,
    p_events: changes.events,
    p_notes: changes.notes,
    p_folders: changes.folders,
  });
  if (error) throw error;
}

/**
 * Rows changed on the server since `sinceMs` (by the server-clock synced_at
 * column), mapped back to the camelCase client record shape. The returned
 * cursor lags ~2s behind the server clock: rows committed between the query
 * snapshot and the response get re-delivered next pull, which the client's
 * idempotent merge absorbs.
 */
export async function pullLocalRecords(
  userId: string,
  sinceMs: number,
  limit = 500,
): Promise<SyncPullResponse> {
  const since = new Date(sinceMs).toISOString();
  const [todos, events, notes, folders] = await Promise.all([
    admin().from("todos").select("*").eq("user_id", userId)
      .gt("synced_at", since).order("synced_at").limit(limit),
    admin().from("events").select("*").eq("user_id", userId)
      .gt("synced_at", since).order("synced_at").limit(limit),
    admin().from("notes").select("*").eq("user_id", userId)
      .gt("synced_at", since).order("synced_at").limit(limit),
    admin().from("folders").select("*").eq("user_id", userId)
      .gt("synced_at", since).order("synced_at").limit(limit),
  ]);
  if (todos.error) throw todos.error;
  if (events.error) throw events.error;
  if (notes.error) throw notes.error;
  if (folders.error) throw folders.error;

  return {
    cursor: Date.now() - 2000,
    todos: (todos.data ?? []).map((row: TodoRow) => ({
      id: row.id,
      userId: row.user_id,
      text: row.text,
      completed: row.completed,
      completedAt: row.completed_at,
      date: row.date,
      blockerId: row.blocker_id,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    })),
    events: (events.data ?? []).map((row: EventRow) => ({
      id: row.id,
      userId: row.user_id,
      title: row.title,
      description: row.description,
      date: row.date,
      allDay: row.all_day,
      startMin: row.start_min,
      endMin: row.end_min,
      location: row.location,
      source: row.source,
      externalId: row.external_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    })),
    notes: (notes.data ?? []).map((row: NoteRow) => ({
      id: row.id,
      userId: row.user_id,
      folderId: row.folder_id,
      title: row.title,
      content: row.content,
      date: row.date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    })),
    folders: (folders.data ?? []).map((row: FolderRow) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    })),
  };
}

// Snake_case row shapes as supabase-js returns them (date columns arrive as
// "YYYY-MM-DD" strings; jsonb arrives parsed).
interface TodoRow {
  id: string; user_id: string; text: string; completed: boolean;
  completed_at: number | null; date: string | null; blocker_id: string | null;
  sort_order: number; created_at: number; updated_at: number; deleted: boolean;
}
interface EventRow {
  id: string; user_id: string; title: string; description: string;
  date: string; all_day: boolean; start_min: number | null; end_min: number | null;
  location: string | null; source: string; external_id: string | null;
  created_at: number; updated_at: number; deleted: boolean;
}
interface NoteRow {
  id: string; user_id: string; folder_id: string | null; title: string;
  content: unknown; date: string | null;
  created_at: number; updated_at: number; deleted: boolean;
}
interface FolderRow {
  id: string; user_id: string; name: string; sort_order: number;
  created_at: number; updated_at: number; deleted: boolean;
}
