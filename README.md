# Life Dashboard

A private, single-person dashboard for the whole of life — goals, food, training, body,
tasks, tracked time, a planned day, a job-search pipeline and money — that you can drive by
**voice**: say what should happen and the app does it through its own tools. The same tools are
exposed over MCP, so an AI assistant of your choice can read and update the dashboard too.

It is deliberately **not** a fitness app with fixed features. Everything on the dashboard is
generated from a generic goal system: a goal has a type, a period, an optional target and a
*metric source* — "protein from the food log", "time tracked · study", "money spent · food".
Change the goals and the dashboard, checklist, weekly review and assistant follow.

---

## Contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [The assistant (voice and text)](#the-assistant-voice-and-text)
- [Using it on a phone](#using-it-on-a-phone)
- [Database and migrations](#database-and-migrations)
- [Development commands](#development-commands)
- [Tests](#tests)
- [Deploying to Vercel](#deploying-to-vercel)
- [MCP server](#mcp-server)
- [Monitor mode](#monitor-mode)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Adding a metric, area or tool](#adding-a-metric-area-or-tool)
- [Architecture notes](#architecture-notes)

---

## What it does

| Area | What you get |
| --- | --- |
| **Dashboard** (`/`) | The single next action (a block happening now, an overdue task, a bill due, an application step, then goals), configurable goal cards, today's plan, open tasks, quick actions, training, body, money, career, 7-day summary, notes. |
| **Goals** (`/goals`) | Add, edit, pause, reorder, archive. Types: numeric, duration, boolean, count. Periods: daily, weekly, monthly, one-time. Metric sources include tracked time (per category), tasks completed, applications sent, spend (per category or all) and income. |
| **Plan** (`/plan`) | A day as time blocks. Routines (gym 07:00 on mon/wed/fri…) become blocks with "Plan my day"; one-off blocks are added by hand or by voice. |
| **Tasks** (`/tasks`) | To-dos with area, due date and priority, grouped overdue / today / upcoming / no date / done. |
| **Time** (`/time`) | One running timer at a time, finished sessions by category, per-area totals, a weekly trend. Sessions feed "time tracked" goals. |
| **Career** (`/career`) | Applications by stage (wishlist → applied → screening → interview → offer / rejected) with next steps and dates; prep time this week. |
| **Money** (`/money`) | Manual ledger: expenses by category, income, accounts (bank, cash, wallet, credit card with limit and due day), bills and pending payments; spend today / week / month. Balances update with every entry. |
| **Food / Training / Body / History / Review** | Unchanged from the fitness core: food log with reusable foods and meal templates, workouts with sets and templates, weight/sleep/water, history charts, weekly review. |
| **Monitor mode** (`/monitor`) | Second-screen view: large clock, next action, goal progress, plan, tasks, money, training, weight, weekly trend. Refreshes every minute. |
| **Assistant** | `Ctrl`/`Cmd` + `K`: type or dictate. Recognised quick commands (`+500 ml water`, `weigh 50.4 kg`) run instantly with no model; anything else goes to the assistant, which calls the same tools and answers in a sentence. Destructive requests ask for confirmation. |
| **MCP** (`/api/mcp`) | 42 narrowly scoped tools behind bearer-token auth, with an audit row per mutation. |

## Stack

- **Next.js 16** (App Router, React 19, server actions) · **TypeScript** strict, no `any`
- **Tailwind CSS v4** + **shadcn/ui** (Radix); Instrument Serif for headlines, Geist for everything else
- **PostgreSQL** + **Drizzle ORM** (`postgres.js`)
- **Gemini** through its OpenAI-compatible endpoint, via the `openai` SDK (any OpenAI-compatible provider works)
- **@modelcontextprotocol/server** + **mcp-handler** for MCP
- **Web Speech API** for dictation (no extension, no server audio)
- **Vitest**

---

## Local setup

**Prerequisites:** Node 20+ (developed on 24) and Docker, or any PostgreSQL 14+.

```bash
git clone <your-repo> life-dashboard && cd life-dashboard
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run db:up                  # local Postgres in Docker, port 5433
npm run db:migrate
npm run dev
```

Open <http://localhost:3000> and sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`. The owner account
is created automatically on first sign-in.

Optional, development only: `npm run db:seed` loads sample goals, food, a workout, tasks, time,
routines, applications and money so every page has something to show. Rows it writes are tagged
`source: "seed"` and refuse to load in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. In production use the **pooled** URL. |
| `AUTH_USERNAME` | no (default `owner`) | The single account that owns all data. |
| `AUTH_PASSWORD` | yes | Password for `/login`. Minimum 8 characters — make it long. |
| `AUTH_SECRET` | yes | HMAC key for the session cookie. Minimum 32 characters. `openssl rand -base64 48` |
| `MCP_TOKEN` | no | Bearer token for `/api/mcp`. **Unset = MCP endpoint disabled.** `openssl rand -hex 32` |
| `ASSISTANT_API_KEY` | no | API key for the assistant's model. **Unset = assistant hidden** (quick commands still work). Default provider is Gemini: get a key at <https://aistudio.google.com/apikey>. |
| `ASSISTANT_BASE_URL` | no | Any OpenAI-compatible chat endpoint. Defaults to Gemini's (`https://generativelanguage.googleapis.com/v1beta/openai/`). |
| `ASSISTANT_MODEL` | no | Model id. Defaults to `gemini-3.6-flash` (run `curl …/v1beta/openai/models` with your key to see what your account offers). |
| `ASSISTANT_FALLBACK_MODEL` | no | Tried once when the primary model answers 429/503. Defaults to `gemini-3.1-flash-lite` (its own free quota); set to `""` to disable. |

The app validates these at startup and fails with a readable message if any are missing or too
short. `.env.local` is git-ignored.

## The assistant (voice and text)

Press `Ctrl`/`Cmd` + `K` anywhere (or `Ctrl`/`Cmd` + `Shift` + `K` to open already listening; the
mic button in the header does the same). Then type or speak:

- `+500 ml water`, `+25 g protein`, `log 450 kcal lunch`, `weigh 50.4 kg`, `slept 7.5h` — recognised
  locally and logged instantly, no model involved.
- Anything else — "start a study timer", "add task update resume by Friday", "I spent 250 on
  lunch", "move Acme to interview", "plan my day", "what did I eat today" — goes to the model,
  which calls the app's tools and replies in one sentence. What it did is listed under the reply.
- Removing or archiving things comes back as a card: **Confirm** or **Cancel** (typing or saying
  "yes" / "no" works too). Nothing destructive runs without that.

Design notes worth knowing:

- A request that only *writes* costs exactly **one** model call — the reply is built from the tool
  results. Questions (reads) take two. Free-tier quotas go a long way.
- The model never sees a UUID it has to reproduce: tasks, applications, bills and accounts are
  matched loosely by name, and ambiguity is a clear error ("Ambiguous task 'email': Email Alice,
  Email Bob").
- Life areas and expense categories are closed lists, which small models get right far more often
  than free text.
- Replies can be read aloud (speaker toggle in the box; remembered per device).
- Every write the assistant makes is tagged `source: "assistant"` and audited with its channel.

**Estimates.** Where a number is guessable, an *Estimate* button asks the model for a sensible value:
calories and macros for a food and quantity (with the assumption it made), a category for an
expense, and area / priority / due date for a task typed in a hurry ("update resume by Friday").
Estimated food values are stored flagged and shown with **≈** so a guess is never mistaken for a
measurement. By voice, "log a bowl of oats" logs typical values marked as an estimate rather than
asking you for macros.

**Briefing.** The dashboard's *Assistant* card answers "what should I do now?" with one line and 3–5
specific, prioritised suggestions grounded in today's data; suggestions the app can carry out have
a *Do it* button (non-destructive tools only — anything destructive still goes through the confirm
card). Generated on demand and kept for the session.

Test from the terminal without the browser:

```bash
npm run assistant:smoke -- "log 500 ml water"
npm run assistant:estimate -- food "masala dosa with sambar"
```

Free tiers have small per-model quotas; when the primary model is rate-limited the runner retries
once with the fallback model, and beyond that the app says so instead of failing silently.

Speech recognition uses the browser's Web Speech API: Chrome, Edge and Safari (desktop and phone).
Firefox has none, so the mic is hidden there and typing works identically.

Provider swap: the runner speaks the OpenAI chat-completions dialect, so OpenAI, Groq, OpenRouter or
a local router such as OmniRoute work by changing `ASSISTANT_BASE_URL` / `ASSISTANT_MODEL`. Note that
Google may use free-tier prompts for training; use a paid key or another provider if that matters.

## Using it on a phone

The same deployment is a PWA. Open it in Chrome (Android) or Safari (iOS) and choose **Add to
Home Screen** — it installs as a standalone app. Phones get a five-tab bar (Today, Plan, Tasks,
Money, More), a floating microphone button in thumb reach, and the assistant box as a bottom sheet.
The **More** tab (Settings) lists every page. Dictation on iOS needs a tap per utterance
(tap to start, speak, tap to stop or just pause).

## Database and migrations

Migrations are plain SQL files in `drizzle/`, generated from `src/db/schema.ts`.

```bash
npm run db:up         # start the local Postgres container (needed before dev)
npm run db:down       # stop it
npm run db:generate   # after editing the schema — writes a new migration
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the data in Drizzle Studio
npm run db:reset      # DEV ONLY: drop everything and re-migrate
```

The container does not survive a reboot: if every page suddenly errors, `npm run db:up`. Data is on
a volume and is not lost.

## Development commands

```bash
npm run dev            # dev server on http://localhost:3000
npm run build          # production build (needs no env vars)
npm run start          # run the production build
npm run lint           # ESLint
npm run typecheck      # route typegen + tsc --noEmit
npm test               # Vitest (single run)
npm run test:watch
npm run db:seed        # development-only sample data
npm run assistant:smoke -- "…"   # one assistant request from the terminal
```

## Tests

```bash
npm test
```

Pure logic (no database): dates and timezones, goal maths and statuses, the metric registry and
parameterised metrics, food totals, weekly aggregation, the next-action policy (blocks → overdue
tasks → bills → application steps → goals), quick-entry parsing, plan helpers (weekday masks,
current/next block), validation, the tool registry contract (every schema converts to a function
declaration; the destructive set is exactly what it should be), and the assistant runner with a
scripted model (one call for writes, retry-once on malformed output, pending on destructive, 429
surfaced).

Database-backed (use `DATABASE_URL`; create and delete their own users): daily aggregation from event
rows across timezones, every tool family (fitness, tasks/time, career/plan, money) including
cross-user isolation, balance consistency on delete, idempotent day planning, monthly bill roll-over.

## Deploying to Vercel

1. Import the repository in Vercel (framework preset: Next.js).
2. **Storage → Create Database → Neon.** It injects `DATABASE_URL` (use the pooled URL; the app is
   configured for pgBouncer with `max: 1`, `prepare: false`).
3. Add `AUTH_PASSWORD`, `AUTH_SECRET`, and optionally `MCP_TOKEN` and `ASSISTANT_API_KEY` under
   **Settings → Environment Variables**.
4. Deploy, then apply migrations from your machine against the **direct/unpooled** URL:

   ```bash
   DATABASE_URL="<production-direct-url>" npm run db:migrate
   ```

5. If **Deployment Protection** is on, either turn Vercel Authentication off for Production (the app
   has its own login) or enable *Protection Bypass for Automation* — otherwise MCP clients get a
   redirect to Vercel SSO instead of a 401/200.

The build itself needs no environment variables; the database client is created on first use.

## MCP server

**Endpoint:** `https://<your-deployment>/api/mcp` (locally `http://localhost:3000/api/mcp`),
streamable HTTP, `Authorization: Bearer $MCP_TOKEN`.

```bash
claude mcp add --transport http life-dashboard https://<your-deployment>/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

Any client that supports remote servers with a static header works:

```json
{ "mcpServers": { "life-dashboard": { "type": "http", "url": "https://<your-deployment>/api/mcp",
  "headers": { "Authorization": "Bearer <MCP_TOKEN>" } } } }
```

### Tools (42)

| Family | Read | Write | Destructive (confirmed by the in-app assistant) |
| --- | --- | --- | --- |
| Fitness & goals | `get_today`, `get_goals`, `get_goal`, `get_food_log`, `get_workout`, `get_weight_history`, `get_weekly_summary` | `log_food`, `log_water`, `log_weight`, `log_sleep`, `log_workout`, `add_goal`, `update_goal`, `complete_goal`, `add_note` | `remove_goal` |
| Tasks | `list_tasks` | `add_task`, `complete_task`, `update_task` | `delete_task` |
| Time | — | `start_timer`, `stop_timer`, `log_time` | — |
| Career | `list_applications` | `add_application`, `update_application` | `archive_application` |
| Plan | `get_day_plan` | `plan_day`, `add_block`, `complete_block`, `add_routine` | `remove_routine` |
| Money | `get_money_summary` | `log_expense`, `log_income`, `add_bill`, `pay_bill`, `set_account` | `delete_transaction` |

Every tool returns a one-line human summary and the same data as structured JSON. `get_today` is
the one to start with: goals with progress, today's totals, plan, tasks, timer, money and the next
action in one call.

Safety: no SQL and no generic execute tool; all input is validated with the same Zod schemas the
web forms use; the user id comes from the verified token, never from arguments; every mutation is
appended to `mcp_audit_log` with the tool, its arguments, a summary and the channel (`mcp` or
`assistant`); `complete_goal` refuses metric-backed goals so progress cannot be faked.

## Monitor mode

`/monitor` is built for a second screen: clock, date, next action, goal progress, the current or
next block, tasks, money spent today and the next bill, training, weight, weekly trend. It polls
once a minute and uses the browser's Fullscreen API (⤢). Open it from the header or go there
directly.

## Troubleshooting

**Every page errors, or sign-in fails.** The database is not running: `npm run db:up`. The app says
so explicitly ("Cannot reach the database…").

**"Invalid environment configuration".** `.env.local` is missing or a value is too short.

**A relation does not exist.** Migrations have not been applied: `npm run db:migrate` (on a fresh
Vercel deployment this is the required second step).

**The assistant says it is not configured.** Set `ASSISTANT_API_KEY`. Test with
`npm run assistant:smoke -- "log 500 ml water"`.

**"Rate-limited right now".** The provider returned 429; wait a minute. Free-tier quotas are per
minute and per day — check yours in AI Studio.

**The Vercel URL 404s.** That domain is not assigned to your project — `*.vercel.app` names are
global; check the real URL in the Vercel dashboard rather than guessing.

**Port 3000 is taken.** `PORT=3001 npm run dev`.

## Security notes

- Single account defined by env vars; nothing is publicly readable. Every page is behind
  `src/proxy.ts` (only `/login`, `/api/mcp`, the manifest and icons are exempt).
- Session: `jose`-signed JWT in an `httpOnly`, `sameSite=lax`, `secure`-in-production cookie, 30
  days. Credentials and the MCP token are compared with `timingSafeEqual`.
- Secrets are read only through `src/lib/env.ts` (`server-only`) and never reach client code. The
  assistant's key is used server-side only; the browser talks to `/api/assistant`, which is
  session-gated.
- Every query is scoped by `userId`; the data model is multi-user-safe by construction.
- `robots: noindex, nofollow`.

## Adding a metric, area or tool

**A new automatic metric** (progress derived from logged data):

1. Add the key to `METRIC_KEYS` in `src/lib/domain.ts`.
2. Add the field it reads to `DayFacts` in `src/lib/metrics.ts` and populate it in `loadDayFacts`
   (`src/server/services/day.ts`).
3. Add an entry to the `METRICS` registry with a label, default unit, suggested goal type, an
   aggregation (`sum` or `latest`) and — if it needs one — a `param` (`area` or `expenseCategory`,
   required or optional). `validateMetricParam` in `src/lib/validation.ts` enforces it everywhere.

It appears in the goal form's "Tracked from" list, on the dashboard, in the review and in
`add_goal` with no UI change.

**A new life area or expense category:** one entry in `AREA_KEYS` / `EXPENSE_CATEGORIES` and its
label in `src/lib/domain.ts`. Tool schemas, pickers and validation pick it up.

**A new tool** (and therefore a new voice command and MCP tool): add a `defineTool({...})` entry to
the relevant file in `src/mcp/tools/` — name, title, description (written for a model), a Zod input
schema from `src/mcp/schemas.ts`, `kind` (`read` | `write` | `destructive`), `run`, and for
destructive tools a `describe` that phrases the confirmation. Add the list to `TOOLS` in
`src/mcp/registry.ts`. MCP registration, the model's function declarations, confirmation and audit
all come from that one definition. Extend `tests/tool-registry.test.ts` counts.

**A new next-action rule:** add a strategy to `DEFAULT_STRATEGIES` in `src/lib/next-action.ts`; the
order of the list is the priority.

## Architecture notes

```
src/
  app/            routes: (app) group = authenticated shell, /login, /monitor, /api/{assistant,mcp,monitor,export}
  assistant/      client (OpenAI-compatible), prompt, context digest, runner, types
  components/     ui/ (shadcn) + feature folders: assistant, dashboard, goals, food, body, workouts,
                  tasks, time, plan, career, money, log, charts, layout, settings, monitor
  db/             Drizzle schema and (lazily created) client
  lib/            pure business logic — no database imports; fully unit-tested
  mcp/            registry, tool definitions per family, schemas, auth, audit, MCP server glue
  server/         auth, services (data access + orchestration), server actions
```

Four rules keep it coherent:

1. **Calculations are pure and live in `src/lib`.** `DayFacts` → goal progress → summaries → next
   action. The database layer produces `DayFacts`; everything downstream is arithmetic.
2. **Daily totals are never stored.** Every event row carries an absolute `occurredAt` and a
   `localDate` bucket in the user's timezone; totals are recomputed in one place (`loadDayFacts`).
3. **One tool registry, three consumers.** The web actions, the MCP server and the in-app assistant
   share the services and the Zod schemas; MCP and the assistant share the exact tool definitions.
4. **Closed vocabularies for anything a model has to name.** Areas, categories, stages and kinds are
   `as const` lists validated by Zod, stored as text — no migration to extend, and a strict enum in
   every tool schema.
