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
  notes: string;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  date: string; // YYYY-MM-DD
  status: CompletionStatus;
}
