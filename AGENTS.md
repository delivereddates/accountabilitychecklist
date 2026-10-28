<!-- BEGIN:nextjs-agent-rules -->
# Next.js notes

This repo runs stock **Next.js 15.5 (App Router)** — no local fork. The 15.x
changes that matter here:

- `params` / `searchParams` in pages, layouts, and route handlers are
  **Promises**: `const { id } = await params;`
- `viewport` is its own export (`export const viewport: Viewport`), separate
  from `metadata`.

Follow the conventions already used in `app/`: route groups for shared
layouts, `app/api/**/route.ts` handlers with `requireUser` from `@/lib/auth`,
thin server pages wrapping client components in `components/`.
<!-- END:nextjs-agent-rules -->

# Deployment

Commits are **pushed manually by the user** — never run `git push` yourself.
Vercel deploys every push to production, and the user tests there directly
(no local dev server). Commit when the work passes `npm run lint` and
`npm run build`, then stop and say so.

Database migrations (`supabase/*.sql`) are also applied manually by the
user in the Supabase SQL editor — flag any SQL changes that need running.
