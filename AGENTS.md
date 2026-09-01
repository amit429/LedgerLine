<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ledgerline

A payments/orders reconciliation dashboard: a deterministic matching
engine, Supabase (Postgres + Auth + RLS), and an LLM explanation layer on
top. Full product context, architecture, the reconciliation rules, and
findings live in `README.md` — read that first for the *what* and *why*.
This file is for the *how to work in this repo without breaking something
non-obvious*.

## Non-negotiable invariants

- **`lib/reconciliation/` stays pure.** No I/O, no `Date.now()` /
  `Math.random()`, no import of anything under `lib/llm/`.
  `reconcile(orders, payments, config)` must return the same output for
  the same input every time — that determinism is graded, and
  `lib/reconciliation/__tests__/integration.test.ts` runs the real CSV
  fixtures through it and asserts exact counts.
- **The LLM never decides matches.** `lib/llm/` only turns an
  already-persisted `Discrepancy` into prose. It must have zero import of
  `lib/reconciliation/*` beyond type-only imports.
- **Money is integer cents, always.** Never `parseFloat(x) * 100` — parse
  the decimal string straight to cents. No float arithmetic on money
  anywhere in this codebase.
- **Payment dates are day-first (`DD/MM/YYYY`)**, parsed with the
  hand-rolled regex in `lib/reconciliation/normalize.ts`. Never
  `new Date(paymentDateString)` — it silently assumes month-first and
  would corrupt roughly half the rows. Order dates are ISO and parse fine
  normally.
- **Auth is double-layered on purpose — don't remove either layer.**
  `proxy.ts` refreshes the Supabase session on every request and does an
  *optimistic* redirect; `app/(app)/layout.tsx` does the *real* check
  server-side before rendering; every table has RLS
  (`auth.uid() = user_id`) as the actual enforcement boundary. Each layer
  alone is either bypassable or just a UX nicety — all three together are
  what make "users only see their own data" true.
- **This is Next.js 16, not the Next.js in your training data.**
  `middleware.ts` is deprecated here — the file is `proxy.ts`, exporting a
  function named `proxy`, not `middleware`. Before touching routing,
  caching, or auth-adjacent code, check `node_modules/next/dist/docs/`
  for the current API rather than assuming.

## Git workflow

**Never run `git commit` in this repo.** Stage changes with `git add` and
hand back the exact commit message(s) for the user to run themselves —
this is a standing instruction, not a one-off judgment call. Only commit
directly if explicitly told to for that specific change.

## Local dev

```bash
npm install
cp .env.example .env.local   # fill in the 4 vars, see README
npm run dev                  # http://localhost:3000
npm test                     # vitest — pure engine + LLM-fallback tests, no live services needed
npm run build                # also runs the full TypeScript check
npx eslint .
```

Migrations live in `supabase/migrations/`, applied in filename order —
plain SQL, no ORM.

## Verification expectations

Unit tests cover the engine and the LLM retry/fallback contract, but the
bugs that actually mattered in this repo's history — a discrepancy that
silently disappeared after ingest-time dedupe, a stale-batch resolution
bug that mislabeled everything as "Matched," a mobile layout that forced
horizontal scroll on every page — were all caught by driving the real
deployed app with a headless browser (Playwright), not by unit tests. For
any UI or auth-flow change, verify it live against the real Supabase
project before calling it done. `tsc` / `eslint` / `vitest` passing is
necessary, not sufficient.

## Where things live

- `lib/reconciliation/` — the pure matching engine (types, normalize,
  group, rules, engine, config)
- `lib/llm/` — Gemini client, schema, prompts, deterministic fallback,
  rate limiter
- `lib/supabase/` — browser + server Supabase client factories
- `lib/batches/` — logic shared between the API layer and pages (active-
  batch resolution, run-history status)
- `components/shared/` — cross-page primitives (`Pagination`,
  `TableSkeleton`) — reach for these before building a new one
- `components/dashboard/`, `components/discrepancies/`,
  `components/imports/`, `components/layout/` — page-specific UI
- `app/(app)/` — authenticated routes; `app/(auth)/` — login/signup;
  `app/api/` — Route Handlers (this *is* the backend, not a separate
  service)
- `supabase/migrations/` — schema + RLS policies, applied in order
- `proxy.ts` — session refresh + optimistic auth redirect (see invariants
  above)
- `ledgerline-ui.html` — the original static mockup; still the source of
  truth for the design tokens in `app/globals.css`

## Deferred, on purpose

Settings (per-user configurable tolerances, re-running a batch against a
different config) was explicitly scoped out. The table for it exists
(`supabase/migrations/*_user_settings.sql`) but nothing reads or writes
it yet — its absence from the nav isn't a bug. See README's "What's next"
for the full list of known gaps and why each was left out.

## Conventions

- No comments explaining *what* code does — names should already do that.
  Comments exist only for non-obvious *why* (a workaround, an invariant,
  a past bug).
- No premature abstraction — three similar lines beat a shared helper
  built for a single caller.
- Tailwind utility classes, no CSS modules. Design tokens are CSS custom
  properties in `app/globals.css`, mirrored as a plain JS map in
  `lib/severity-colors.ts` for anywhere (charts) that needs an actual
  color value rather than a CSS var reference.
