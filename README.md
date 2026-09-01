# Ledgerline

A reconciliation dashboard that matches an order export against a payment
processor's settlement export, classifies every disagreement between them,
and explains the results in plain language on top of a deterministic
matching engine.

**Live app:** https://ledger-line-one.vercel.app

**Account creation:** The sign-up flow works end to end (create an account,
you're immediately signed in)

---

## Quickstart (local)

```bash
git clone <this-repo>
cd LedgerLine
npm install
cp .env.example .env.local   # fill in the four values, see below
npm run dev                  # http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page — safe to expose in the browser, RLS is what protects data |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — server-only, bypasses RLS, used only by `scripts/seed-demo-user.ts` |
| `GEMINI_API_KEY` | aistudio.google.com/apikey — used server-side only for the explanation layer |

Database schema: apply everything in `supabase/migrations/` to a Supabase
project (`supabase db push`, or run each file's SQL in the dashboard's SQL
editor in filename order).

Run the engine's own test suite (no live services needed — it's pure
functions plus fixtures):

```bash
npm test
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Next.js 15 App Router (Vercel)                          │
│                                                            │
│  Client components          Route Handlers (server-only)  │
│  ──────────────────         ──────────────────────────    │
│  dashboard, discrepancies    /api/batches           (CSV   │
│  orders, payments, imports    upload → parse → persist)   │
│  import wizard                /api/batches/:id/reconcile  │
│                                /api/discrepancies          │
│                                /api/orders /api/payments    │
│                                /api/discrepancies/:id/explain│
│                                /api/runs/:id/explain-summary│
│                                                              │
│  lib/reconciliation/  ← pure engine, zero I/O, zero LLM     │
│  lib/llm/              ← Gemini client, isolated from above │
└───────────────────────────┬──────────────────────────────┘
                             │ session-scoped (RLS-enforced)
                     ┌───────▼────────┐
                     │ Supabase        │
                     │ Postgres + Auth │
                     │ Row Level Sec.  │
                     └────────────────┘
```

One Next.js app, not a separate frontend/backend repo: Route Handlers *are*
the backend, which is what keeps the Gemini key server-side without a
second deploy target, a second set of CORS rules, or a cookie-domain
problem. The security boundary that matters is server vs. client, not
repo vs. repo.

**Auth & isolation:** Supabase Auth issues the session; every table has Row
Level Security (`auth.uid() = user_id`) so a user's data is invisible to
every other user at the database layer, not just hidden by application
code. Every API route also resolves the session server-side first (401 if
absent) before touching any query — two independent layers, not one.
`lib/supabase/__tests__/rls.test.ts` proves this by creating two real users
and asserting user B's session cannot read user A's batch.

**Why Supabase over a hand-rolled auth+DB stack:** RLS turns "users only
see their own data" from an application-code discipline into a database
guarantee, and Supabase Auth means no custom password hashing.

---

## Reconciliation logic

The engine (`lib/reconciliation/engine.ts`) is a **pure function**:

```ts
reconcile(orders, payments, config) -> { discrepancies, orders, payments, summary }
```

No I/O, no clock reads, no randomness, no LLM import anywhere in
`lib/reconciliation/`. Same input always produces the same output, and the
exact config used is persisted on every `reconciliation_runs` row, so a
run is reproducible as `(batch, engine_version, config) → result` even
after this file changes.

**Stage 1 — Normalize:** join keys are `trim().toUpperCase()`'d (this
alone is what keeps `ord-1801 ` — lowercase, trailing space — from
becoming two invented discrepancies instead of one clean match). Amounts
are parsed to **integer cents from the decimal string directly** — never
`parseFloat(x) * 100`, which produces things like `11984.000000000002` in
JS float arithmetic. Order dates are ISO; payment dates are day-first
`DD/MM/YYYY`, parsed with a hand-rolled regex, never `new Date(string)`,
which silently assumes month-first and would corrupt roughly half the
rows.

**Stage 2 — Group:** orders and payments join on the normalized key.
Payments are split into charges and refunds up front so a refund is never
compared against `net_amount` as if it were a failed charge.

**Stage 3 — Rules**, evaluated in this order (order matters — see rule 5):

| # | Rule | Condition | Severity | Impact |
|---|---|---|---|---|
| 1 | `MISSING_PAYMENT` | order exists, 0 charges | critical | `net_amount` |
| 2 | `ORPHAN_PAYMENT` | payment key not in orders | critical | `amount` |
| 3 | `DUPLICATE_CHARGE` | ≥2 settled charges, same key | critical | sum of extras |
| 4 | `CANCELLED_BUT_CHARGED` | status cancelled + settled charge | critical | `amount` |
| 5 | `CURRENCY_MISMATCH` | order currency ≠ payment currency | critical | `net_amount` |
| 6 | `AMOUNT_MISMATCH` | \|charge − net_amount\| > tolerance | high | signed delta |
| 7 | `UNSETTLED_PAYMENT` | order completed, charge failed/pending | high | `net_amount` |
| 8 | `PARTIAL_REFUND_GAP` | refunded, charges − refunds > tolerance | high | remainder |
| 9 | `REFUND_STATUS_MISMATCH` | refund exists, order still completed | medium | refund amount |
| 10 | `LATE_SETTLEMENT` | charge lag > settlement window | low (informational) | 0 |
| 11 | `DATA_QUALITY` | null email / discount / processed_at | low (informational) | 0 |
| 12 | `DUPLICATE_ORDER_ROW` | identical order row uploaded twice | low (informational) | 0 |

Everything else is a clean match. **Rule 5 must run before rule 6**: two
records reading `210.00` in different currencies are numerically equal, so
an amount-only comparison would pass them as matched. Currency is checked
first and short-circuits the amount check entirely for that record — the
codebase has a real example of this (`ORD-1601`/`ORD-1602` in the seed
data) with a test (`rules.test.ts`) asserting the ordering.

### Tolerances, and why

```ts
amountTolerance(netCents) = max(5, round(netCents * 0.0005))   // max($0.05, 0.05%)
settlementLagHours = 72
```

The observed rounding noise floor in the data is $0.02; the smallest
genuine mismatch is $18.50. Any number between those two works, which is
exactly why picking one *fitted to the gap* would be a bad idea — it says
nothing about the real world, only about this one file. $0.05 is instead a
floor with an independent justification (a half-cent rounding allowance
that survives currency conversion and processor rounding), plus a 0.05%
relative term so it stays proportionate if order values scale up. On this
dataset the absolute floor always wins.

The settlement window: median charge lag is 42 minutes, p75 is 68 minutes,
and the one real outlier settles 29 days late. 72 hours is roughly 1000×
the median and leaves room for weekend batch settlement. It applies to
charges only — a refund landing 3 days after its order is normal, not
late, and is deliberately excluded.

### Money definitions used on the dashboard

```
Total order value      = Σ net_amount over unique, non-cancelled orders
Total payments settled = Σ amount where type=charge AND status=settled
Value reconciled       = Σ net_amount of orders with zero discrepancies of any kind
Value in dispute       = Σ net_amount of orders carrying ≥1 money-affecting discrepancy
Money at risk           = Σ |impact| over critical + high severity only
```

Two scoping decisions worth stating explicitly, because both are easy to
get wrong silently:

1. **"Carrying a discrepancy" for value-in-dispute is scoped to the 9
   money-affecting rule types**, not the 3 informational ones (late
   settlement, data quality, duplicate row). Those are worth a human's
   attention but represent no money actually at stake.
2. **"In dispute" and "at risk" are answering different questions** and
   are labeled separately rather than merged: in-dispute is order-level
   (each disputed order counted once, at its full net value); at-risk is
   impact-level (sums the actual dollar delta per discrepancy, which for
   `AMOUNT_MISMATCH` is much smaller than the order's full value — a $25
   overcharge on a $92 order puts $25 at risk, not $92).

### What we deliberately did **not** flag, and why

This dataset has two seeded false-positive traps, and correctly not
flagging them is arguably a bigger signal than finding the real ones:

- **`ord-1801 ` / `ord-1802`** — lowercase, one with a trailing space.
  Joining raw would invent two fake missing-payments and two fake
  orphan-payments. Normalizing the key before joining fixes it — this
  isn't a discrepancy, it's a formatting difference.
- **`ORD-1901`–`ORD-1903`** — $0.01–$0.02 rounding artifacts, well inside
  the tolerance floor. Flagging sub-cent noise as a real mismatch would be
  a worse answer than missing one, per the brief's own evaluation
  criteria.

`lib/reconciliation/__tests__/integration.test.ts` runs the real engine
against the real CSVs and asserts zero discrepancies on both traps
directly — not by inspection, by a failing test if that ever regresses.

---

## What we found in the data

Verified live against the deployed app on the real dataset (184 unique
orders after deduping a byte-identical duplicate row, 187 payments):

- **19 true discrepancies** across 9 money-affecting classes, plus 3
  informational flags (one 29-day-late settlement, two data-quality
  blanks) and the one duplicate order row.
- **$2,306.37** of order value sits in dispute — about 5.5% of the
  $42,094.65 total order value.
- **$2,079.43** is genuinely at risk (critical + high severity impact
  only).
- **164 of 184 orders** matched cleanly with no flags at all.

In plain terms: four completed orders (**$392.35**) were never charged at
all — most likely the checkout session failed after the order row was
written, and it's worth confirming with the processor before writing them
off. Three payments (**$308.00**) reference orders that don't exist in the
export, which either means the order export is incomplete or those
orders were created and then deleted upstream. Two customers were billed
twice roughly 30 minutes apart (**$248.58**) on charges that will likely
return as chargebacks in 30–60 days if not refunded proactively. Two
orders (**$355.00**) can't currently be valued at all because the order
currency and the settlement currency disagree with no FX rate on file —
that one needs a human decision, not an automated one.

---

## LLM approach

The brief is explicit that the model explains, it never decides whether
two records match — and that's enforced structurally, not just by
convention: `lib/llm/` has zero import of anything under
`lib/reconciliation/` beyond type definitions. It never touches the
engine, never receives a raw CSV row, and only ever turns an
already-persisted, already-final discrepancy record into prose.

**Two prompts** (`lib/llm/prompts.ts`): a per-discrepancy explanation
(headline / likely cause / business impact / recommended action /
confidence) and a portfolio-level 1–3 bullet briefing summarizing a whole
run. Both are sent only the structured fields — never the raw files, and
never `customer_email`, the one PII field in this dataset, which isn't
needed to explain a rule-based mismatch.

**Model: `gemini-2.5-flash`** (Google), chosen for the same reason
`gpt-4o-mini` would be: this is a restatement task, not one that needs a
flagship model's reasoning — fast, cheap, and more than capable of turning
a structured record into a few sentences. Thinking is explicitly disabled
(`thinkingConfig: { thinkingBudget: 0 }`) since deliberation isn't useful
here and would only spend the output-token budget on reasoning instead of
the actual answer.

**Structured output:** the request sends `responseJsonSchema`, generated
from the *same* Zod schema used to validate the response
(`z.toJSONSchema()` in `lib/llm/schema.ts` — one definition, not two kept
in sync by hand). Gemini's schema support is a subset of JSON Schema and
doesn't cover everything Zod does (e.g. a string's max length), so unlike
OpenAI's strict mode this is a strong hint to the model rather than a hard
guarantee. The real enforcement is what already existed regardless of
provider: every response is parsed and Zod-validated in
`lib/llm/client.ts` before it's accepted, so a response that's
syntactically valid JSON but violates the contract (wrong enum value,
missing field, headline too long) is still caught and still triggers the
same retry-then-fallback path below.

**Temperature: 0.2**, deliberately near-zero but not exactly zero. This is
a deterministic classification being restated in plain English, not a
creative task — near-zero keeps the same discrepancy producing
essentially the same explanation across reloads, which matters because
it sits directly next to a number someone will act on. Not exactly 0,
to avoid stilted, templated-sounding phrasing. `topP: 1`, capped
`maxOutputTokens`, 10-second timeout.

**Failure handling, all four layers the brief asks for:**
1. The response is Zod-validated; an invalid, malformed, or refused
   response is retried once (`lib/llm/client.ts`).
2. If it's still invalid, times out, or Gemini returns an error, a
   deterministic template built purely from the discrepancy's own fields
   takes over (`lib/llm/fallback.ts`) — no network call, the UI never
   breaks. Fallback results are deliberately **not** cached, so the next
   attempt tries the real model fresh instead of being stuck on a
   template.
3. Successful explanations are cached on the discrepancy row
   (`llm_explanation` / `llm_generated_at`) — instant on reload, bounded
   API cost, and the same discrepancy shows the same text tomorrow.
4. Requests are rate-limited per user (30/hour), counted by querying
   `llm_generated_at` timestamps in the trailing hour rather than a new
   in-memory bucket, which wouldn't survive across serverless invocations
   anyway. (A real production version of this would use Redis for a
   proper sliding window — noted under What's next.)

 Both the dashboard's portfolio briefing and the per-discrepancy
drawer degrade to the deterministic template with a clear "generated from
a template" disclaimer, no crash, no broken UI, and the deterministic
numbers on the rest of the page are visibly unaffected either way.
`lib/llm/__tests__/client.test.ts` covers the same retry-then-fallback
contract without needing network access, asserting exactly one retry
(not an unbounded loop) before it throws — including the Gemini-specific
case of a response that's valid JSON but fails Zod validation, which is
exactly the gap the provider's own schema support doesn't cover.

---

## Robustness

- **RLS test** (`lib/supabase/__tests__/rls.test.ts`): creates two real
  users against the live Supabase project, has user B attempt to read
  user A's batch, asserts it comes back empty rather than erroring (an
  error would leak that the row exists at all — this is the fail-closed
  behavior that actually matters).
- **Malformed-LLM test** (`lib/llm/__tests__/client.test.ts` +
  `fallback.test.ts`): proves the retry-once-then-fallback contract, and
  that the fallback template is schema-valid for all 12 discrepancy types.
- **False-positive test** (`lib/reconciliation/__tests__/integration.test.ts`):
  runs the real engine against the real CSVs and asserts the exact
  expected counts, not just "some number of discrepancies."

---

## What's next

- **Settings / configurable tolerances.** A separate settings section for the user to enable disable the types of discrepencies. Settings for user to change explain models and change the various parameters for tolerences and amount discrepencies
- **FX-rate table** so currency mismatches can be valued instead of just
  flagged.
- **Fuzzy matching** (email + amount + date) for orphan payments with no
  valid order reference, instead of leaving them permanently orphaned.
- **A real resolution workflow.** "Mark as resolved" / "Add note" exist in
  the UI but are deliberately disabled, non-persisted state right now —
  the brief doesn't ask for a resolution workflow, and building one would
  have been scope creep on top of what's actually graded.
- **Redis-backed rate limiting** for the LLM endpoints instead of the
  current DB-query-based hourly count, for a real production deployment.
- **Better mobile responsiveness** instead of the current horizontally-scrolling
  compact top nav below desktop widths — functional and never causes
  page-level horizontal scroll, but a slide-out drawer would read better.

---

## AI tool usage

**Analysis.** I went through `orders.csv` and `payments.csv` myself first —
row by row, looking for whatever didn't line up — before touching any
tooling. Once I had my own list of suspected discrepancy patterns, I ran a
second pass with Claude, feeding it the files alongside my own findings so
it could sanity-check them and catch anything I'd missed. That combined
pass is what surfaced the two deliberate false-positive traps in the data
(the `'ord-1801 '` reference-normalization case and the currency-vs-amount
ordering case) — patterns that are easy to either miss entirely or
mis-flag as real discrepancies if you're not looking for them specifically.

**Architecture.** From that analysis I worked with Claude to map every
finding onto an actual system: a schema, an API surface, a reconciliation
engine design, and the tolerance formulas with the reasoning behind each
one — then worked through the bigger trade-offs (Supabase + RLS instead of
a hand-rolled auth layer, keeping the deterministic engine structurally
isolated from the LLM layer, dedupe-at-ingest vs. dedupe-at-reconcile,
etc.) until the design actually held together end to end, not just for the
happy path.

**Design.** I designed the UI in Figma — dashboard, discrepancies,
orders/payments, and the import flow — and used that as the reference for
a static HTML/CSS mockup, so there was a concrete visual target before any
real application code existed.

**Planning.** Only once the analysis, architecture, and design were
settled did I write out a full phased execution plan: the reconciliation
engine first, proven against the real CSVs in isolation before anything
else touched it; then schema, auth, and RLS; then ingestion; then each
screen; then the LLM layer; then a polish pass; after everything else already worked end to end. I handed that plan
to Claude Code and directed the build phase by phase from there.

**Implementation.** Built with Claude Code (Sonnet 5), phase by phase
against that plan, with me reviewing and redirecting along the way — not
a single autonomous pass. Notably: extensive verification was done by
actually driving the deployed app with a headless browser against the
real Supabase project — not just unit tests — which is how several real
bugs surfaced and got fixed during the build rather than after
