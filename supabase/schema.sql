-- ===========================================================================
-- Accountability Checklist — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard > SQL > New query).
-- It is idempotent: safe to re-run.
-- ===========================================================================

-- Required extension for gen_random_uuid() (enabled by default on Supabase).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Status enum for daily task completions
--   check     = task completed that day
--   no_check  = task not completed (also the implicit default when no row exists)
--   exempt    = user on vacation/ill — excluded from the completion denominator
-- ---------------------------------------------------------------------------
do $$ begin
  create type task_status as enum ('check', 'no_check', 'exempt');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- users: a named person (e.g. "Oliver"). name is unique.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tasks: a recurring task owned by one user (e.g. "do posture exercises").
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  title      text not null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on public.tasks(user_id);

-- ---------------------------------------------------------------------------
-- task_completions: the status of one task on one calendar day.
-- UNIQUE(task_id, date) guarantees at most one status per task per day.
-- A missing row is treated as 'no_check' by the application.
-- ---------------------------------------------------------------------------
create table if not exists public.task_completions (
  id      uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  date    date not null,
  status  task_status not null default 'no_check',
  constraint task_completions_task_date_key unique (task_id, date)
);

create index if not exists task_completions_date_idx       on public.task_completions(date);
create index if not exists task_completions_task_id_idx    on public.task_completions(task_id);

-- ===========================================================================
-- Row Level Security
--
-- Auth model: a single shared app password gates the whole site (iron-session).
-- The browser only ever talks to our own /api routes (server-side), which use
-- the SERVICE ROLE key and therefore BYPASS RLS. The anon key is public, so we
-- enable RLS and intentionally add NO permissive policies — that way the public
-- anon key cannot read or write any data directly; only the server can.
--
-- If you later want direct browser access via the anon client, add explicit
-- policies here. By default: locked down.
-- ===========================================================================
alter table public.users             enable row level security;
alter table public.tasks             enable row level security;
alter table public.task_completions  enable row level security;

-- ---------------------------------------------------------------------------
-- Helpful upsert function used by the API: set a task's status for a date,
-- inserting the row if it does not exist. (Equivalent to a Rust/JS upsert on
-- the (task_id, date) conflict, kept here for convenience / direct SQL use.)
-- ---------------------------------------------------------------------------
create or replace function public.set_completion(
  p_task_id uuid,
  p_date    date,
  p_status  task_status
) returns public.task_completions as $$
  insert into public.task_completions (task_id, date, status)
  values (p_task_id, p_date, p_status)
  on conflict (task_id, date) do update
    set status = excluded.status
  returning *;
$$ language sql;
