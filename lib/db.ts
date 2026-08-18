import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CompletionStatus,
  PushSubscriptionRow,
  Task,
  TaskCompletion,
  TaskNote,
  User,
  UserSettings,
} from "./types";

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
    getUsers(),
    getTasks(),
    getCompletions(fromISO, toISO),
  ]);
  return { users, tasks, completions };
}

/** Full dataset (all users, tasks, notes, and completion history) for the client cache. */
export async function getDashboardAll() {
  const [users, tasks, completions, notes] = await Promise.all([
    getUsers(),
    getTasks(),
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

export async function createTask(userId: string, title: string): Promise<Task> {
  const { data, error } = await admin()
    .from("tasks")
    .insert({ user_id: userId, title: title.trim() })
    .select("id, user_id, title, created_at")
    .single();
  if (error) throw error;
  return data as Task;
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

/** Delete a user; cascades to their tasks and all completion history (FK cascade). */
export async function deleteUser(id: string): Promise<void> {
  const { error } = await admin().from("users").delete().eq("id", id);
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
