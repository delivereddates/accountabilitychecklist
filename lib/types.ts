// Shared domain types (mirror the Supabase schema in supabase/schema.sql).

export type CompletionStatus = "check" | "no_check" | "exempt";

export const STATUS_VALUES: CompletionStatus[] = ["check", "no_check", "exempt"];

export interface User {
  id: string;
  name: string;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface TaskNote {
  id: string;
  task_id: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  date: string; // YYYY-MM-DD
  status: CompletionStatus;
}

/** Per-user notification settings (user_settings row; missing row = defaults). */
export interface UserSettings {
  notify_11: boolean;
  notify_17: boolean;
  notify_21: boolean;
  timezone: string | null; // IANA name, e.g. "America/New_York"
}

/** One browser/device push subscription (push_subscriptions row). */
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}
