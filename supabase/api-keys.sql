-- External write-only API keys (POST /api/v1/todos, /api/v1/events).
-- The full secret is generated server-side ("ac_" + 43 base64url chars),
-- shown to the user exactly once at creation, and stored ONLY as a sha256
-- hex hash — a database leak does not expose usable keys. Revoking sets
-- revoked_at; the auth lookup ignores revoked rows immediately.
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,                  -- display only, e.g. "ac_x7Kd9Qm2"
  key_hash     text not null unique,           -- sha256 hex of the full secret
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_user_idx on public.api_keys(user_id, created_at);

-- Service-role only, like every other table: RLS on, no policies.
alter table public.api_keys enable row level security;
