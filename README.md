# Accountability Checklist

A single-password, multi-user **daily accountability tracker**. One shared
password gates the whole app; inside, you track daily task completion for
several people, with daily / weekly / monthly / yearly summaries.

Built with **Next.js (App Router) · TypeScript · Tailwind CSS · iron-session ·
Supabase · date-fns**.

---

## Quick start

### 1. Install & configure env

```bash
npm install
cp .env.example .env.local   # then fill in real values
```

`.env.local` variables (never commit this file):

| Var | Purpose |
| --- | --- |
| `APP_PASSWORD` | The single shared password to enter the app. |
| `SESSION_SECRET` | ≥32 chars; encrypts the iron-session cookie (`openssl rand -hex 32`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (browser-safe). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key (browser-safe). |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **service-role** key (SERVER ONLY — never expose). |

### 2. Create the database schema

Open your Supabase project → **SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and **Run**. It is idempotent
(safe to re-run). This creates `users`, `tasks`, `task_completions`, the
`task_status` enum, the `UNIQUE(task_id, date)` constraint, enables RLS, and
adds a `set_completion()` helper.

> **Why RLS with no public policies?** Auth here is a single app password, not
> per-user Supabase accounts. All reads/writes go through server Route Handlers
> using the **service-role** key (which bypasses RLS). The public anon key is
> intentionally left powerless so the password gate is the only way in.

### 3. Run

```bash
npm run dev
```

Open http://localhost:3000 → you're redirected to `/login`. Enter `APP_PASSWORD`.

---

## How it works

### Data model

- **`users`** — `{ id, name (unique), created_at }`
- **`tasks`** — `{ id, user_id→users, title, created_at }` (recurring task owned by a user)
- **`task_completions`** — `{ id, task_id→tasks, date (YYYY-MM-DD), status }`
  with `UNIQUE(task_id, date)`. `status` ∈ `check | no_check | exempt` (default
  `no_check`). **A missing row = `no_check`.**

### Scoring (exempt never counts against you)

Handled centrally in [`lib/scoring.ts`](lib/scoring.ts):

```
denominator = total_tasks − exempt_tasks
percent     = checked_tasks / denominator   (null if denominator is 0 → "no data")
```

So "3 checked, 1 exempt, of 4" = 3/3 = **100%**.

### Architecture

- **Auth:** [`middleware.ts`](middleware.ts) gates every route except `/login`,
  `/api/*`, and static assets via an iron-session cookie
  ([`lib/session.ts`](lib/session.ts)). `/api/login` & `/api/logout` manage it.
- **Data access:** all DB calls are server-side through
  [`lib/db.ts`](lib/db.ts) (service-role client). The browser client
  ([`lib/supabase.ts`](lib/supabase.ts)) is RLS-locked and unused for data.
- **Mutations** go through REST-ish route handlers under `app/api/`
  (`users`, `tasks`, `tasks/[id]`, `completions`) and are called from the Daily
  editor with optimistic UI.

### Pages

| Route | Purpose |
| --- | --- |
| `/login` | Single-password entrance. |
| `/` (Daily) | Edit today vs. yesterday side-by-side; 3-way toggles; add users & tasks. |
| `/week` | Task × 7-day matrix (`?mode=rolling` last-7 vs `calendar` Mon–Sun). |
| `/month` | Calendar density grid with per-user dots (`rolling` 30 vs calendar month). |
| `/year` | Concentric-rings SVG heatmap — one ring per user, 365 radial day-segments, hover for day breakdown. |

All summary pages support `?date=YYYY-MM-DD` (and `?mode=`) deep-links.

---

## Scripts

```bash
npm run dev     # local dev
npm run build   # production build
npm run start   # serve the production build
npm run lint    # eslint
```

---

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub/GitLab/Bitbucket).
2. Import the repo in Vercel.
3. Add the five env vars above in **Project → Settings → Environment Variables**.
   `SESSION_SECRET` must be ≥32 chars; set a real `APP_PASSWORD`.
4. Deploy. Ensure the Supabase schema (step 2 above) has been run.

## Security notes

- `.env.local` and the service-role key are gitignored — never commit them.
- Rotate any credential that has been shared in plaintext.
- To harden further: restrict Supabase by project API settings, and consider
  moving `APP_PASSWORD` checks behind rate-limiting if exposed to the public.
