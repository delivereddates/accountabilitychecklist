import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CompletionStatus,
  Task,
  TaskCompletion,
  User,
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

/** Full dataset (all users, tasks, and completion history) for the client cache. */
export async function getDashboardAll() {
  const [users, tasks, completions] = await Promise.all([
    getUsers(),
    getTasks(),
    getAllCompletions(),
  ]);
  return { users, tasks, completions };
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

export async function createTask(userId: string, title: string): Promise<Task> {
  const { data, error } = await admin()
    .from("tasks")
    .insert({ user_id: userId, title: title.trim() })
    .select("id, user_id, title, created_at")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(
  id: string,
  title: string,
): Promise<Task> {
  const { data, error } = await admin()
    .from("tasks")
    .update({ title: title.trim() })
    .eq("id", id)
    .select("id, user_id, title, created_at")
    .single();
  if (error) throw error;
  return data as Task;
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
