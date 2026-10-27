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
