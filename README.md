# Life Dashboard

A private, single-person dashboard for goals, nutrition, training and recovery — with an
MCP endpoint so an AI assistant can read and update it through narrowly scoped tools.

It is deliberately **not** a fitness app with fixed features. Everything on the dashboard is
generated from a generic goal system: a goal has a type, a period, an optional target and a
*metric source*. Change the goals and the dashboard, checklist, weekly review and MCP
responses all follow.

---

## Contents

- [What it does](#what-it-does)
- [Stack](#stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database and migrations](#database-and-migrations)
- [Development commands](#development-commands)
- [Tests](#tests)
- [Deploying to Vercel](#deploying-to-vercel)
- [MCP server](#mcp-server)
- [Monitor mode](#monitor-mode)
- [Security notes](#security-notes)
- [Adding a goal type or metric](#adding-a-goal-type-or-metric)
- [Architecture notes](#architecture-notes)

---

## What it does

| Area | What you get |
| --- | --- |
| **Dashboard** (`/`) | Next-action card, configurable goal cards, quick actions, training card with previous-session comparison, body/weight card with chart, 7-day summary, notes. |
| **Goals** (`/goals`) | Add, edit, pause, reorder, archive. Toggle dashboard visibility and checklist membership per goal. Types: numeric, duration, boolean, count. Periods: daily, weekly, monthly, one-time. |
| **Food** (`/food`) | Log entries by meal, edit/duplicate/delete, reusable foods, meal templates. Daily totals are always recomputed from entries. Calories are required; macros are optional. |
| **Body** (`/body`) | Weight history with 7-day average and trend, sleep log, water log with quick-add. |
| **Training** (`/training`) | Workouts, exercises, sets (reps / weight / RPE / done), workout templates, previous performance per exercise. |
| **History** (`/history`) | 7/30/90-day table and charts. |
| **Weekly review** (`/review`) | Averages, goal adherence, streaks, strongest consistency, biggest miss, what deserves attention, notes. |
| **Monitor mode** (`/monitor`) | Full-screen second-monitor view: large clock, next action, goal progress, workout status, weight, weekly trend. Refreshes every 60 s. |
| **Settings** (`/settings`) | Profile (height, starting/target weight, timezone, units), dashboard section visibility, theme, data export/import/delete. |
| **Quick entry** | `Ctrl`/`Cmd` + `K` anywhere: `+500 ml water`, `+25 g protein`, `log 450 kcal lunch`, `weigh 50.4 kg`, `slept 7.5h`, `workout complete`, `note ...`. |
| **MCP** (`/api/mcp`) | 17 scoped tools — 7 read, 10 write — behind bearer-token auth, with an audit trail for every mutation. |

## Stack

- **Next.js 16** (App Router, React 19, server actions)
- **TypeScript** (strict; no `any` in application code)
- **Tailwind CSS v4** + **shadcn/ui** (Radix primitives)
- **PostgreSQL** + **Drizzle ORM** (`postgres.js` driver)
- **@modelcontextprotocol/server** + **mcp-handler** for the MCP endpoint
- **Vitest** for tests
- Charts are hand-written SVG — no charting dependency

---

## Local setup

**Prerequisites:** Node 20+ (developed on 24) and a PostgreSQL 14+ database.

```bash
git clone <your-repo> life-dashboard && cd life-dashboard
npm install
```

Start a local database (a `docker-compose.yml` is included):

```bash
npm run db:up
```

That starts the `life-dashboard-db` container on port **5433**, creating it the first time.
`npm run db:down` stops it. **The container does not survive a reboot** — if the app suddenly
cannot load any page, run `npm run db:up` again; your data is on a volume and is not lost.

Create your environment file:

```bash
cp .env.example .env.local
```

Fill in `.env.local` (see the next section), then create the schema and start the app:

```bash
npm run db:migrate
npm run dev
```

Open <http://localhost:3000>, sign in with `AUTH_USERNAME` / `AUTH_PASSWORD`. The owner account
row is created automatically on first sign-in.

Optionally load development sample data:

```bash
npm run db:seed
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. In production use the **pooled** URL. |
| `AUTH_USERNAME` | no (default `owner`) | The single account that owns all data in this deployment. |
| `AUTH_PASSWORD` | yes | Password for `/login`. Minimum 8 characters — use something long. |
| `AUTH_SECRET` | yes | HMAC key for the session cookie. Minimum 32 characters. `openssl rand -base64 48` |
| `MCP_TOKEN` | no | Bearer token for `/api/mcp`. **Leave unset to disable the MCP endpoint entirely.** Minimum 24 characters. `openssl rand -hex 32` |

Generate secrets:

```bash
openssl rand -base64 48   # AUTH_SECRET
openssl rand -hex 32      # MCP_TOKEN
```

The app validates these at startup and fails with a readable message if any are missing or too
short. `.env.local` is git-ignored; `.env.example` is committed and contains no real values.

## Database and migrations

Migrations are plain SQL files in `drizzle/`, generated from `src/db/schema.ts`.

```bash
npm run db:up         # start the local Postgres container
npm run db:down       # stop it
npm run db:generate   # after editing the schema — writes a new migration
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse the data in Drizzle Studio
npm run db:reset      # DEV ONLY: drop everything and re-migrate
```

Run `npm run db:migrate` once against your production database after the first deploy and after
any schema change.

## Development commands

```bash
npm run db:up        # start the local database (needed before dev)
npm run dev          # dev server on http://localhost:3000
npm run build        # production build
npm run start        # run the production build
npm run lint         # ESLint
npm run typecheck    # route typegen + tsc --noEmit
npm test             # Vitest (single run)
npm run test:watch   # Vitest in watch mode
npm run db:seed      # development-only sample data
```

## Tests

```bash
npm test
```

Covered:

- date/timezone bucketing, week and month boundaries (`tests/date.test.ts`)
- goal progress, percentages, statuses, period windows, checklist completion (`tests/goals.test.ts`)
- the metric registry and metric resolution (`tests/metrics.test.ts`)
- food totals (`tests/nutrition.test.ts`)
- weight statistics, weekly aggregation, adherence, streaks, highlights (`tests/aggregate.test.ts`)
- next-action selection (`tests/next-action.test.ts`)
- quick-entry parsing (`tests/quick-entry.test.ts`)
- MCP input validation (`tests/mcp-schemas.test.ts`)
- MCP read and write tools, bearer-token verification, and **user isolation** (`tests/mcp-tools.test.ts`)
- daily aggregation straight from event rows (`tests/day-facts.test.ts`)
- credential checking and session-token signing (`tests/auth.test.ts`)
- error descriptions, including unreachable-database detection (`tests/errors.test.ts`)

The last three suites need a database and use `DATABASE_URL` from `.env.local`. They create their
own temporary users and delete them afterwards, so they never touch your own data. Without
`DATABASE_URL` they are skipped and the pure-logic suites still run.

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js — no
   overrides needed).
2. Provision Postgres. **Neon** is the path of least resistance: in your Vercel project go to
   **Storage → Create Database → Neon** (Vercel's own "Vercel Postgres" was folded into Neon in
   early 2025, and Neon is now the first-party Marketplace option). It has a free tier, scales to
   zero, and injects `DATABASE_URL` into the project automatically — so you usually do not have to
   set that variable by hand. Supabase works too if you want auth/storage later.

   This app is already configured for a pooled/pgBouncer connection (`max: 1`, `prepare: false`
   in `src/db/index.ts`), so use the **pooled** connection string (the host contains `-pooler`)
   for `DATABASE_URL`.
3. Add the environment variables in **Project → Settings → Environment Variables** for
   *Production* (and *Preview* if you use it):

   | Name | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled Postgres connection string (Neon sets this for you) |
   | `AUTH_USERNAME` | your username (optional, defaults to `owner`) |
   | `AUTH_PASSWORD` | a long random password |
   | `AUTH_SECRET` | `openssl rand -base64 48` |
   | `MCP_TOKEN` | `openssl rand -hex 32` (omit to disable MCP) |

4. Deploy, then apply migrations against the production database from your machine. Migrations
   are DDL, so prefer the **direct/unpooled** URL here (Neon exposes it as `DATABASE_URL_UNPOOLED`
   in the Vercel dashboard):

   ```bash
   DATABASE_URL="<production-direct-url>" npm run db:migrate
   ```

   The pooled URL also works; the direct one just avoids pooler quirks during schema changes.

5. Visit your deployment and sign in. If pages error with *"relation ... does not exist"*, step 4
   has not been run yet. **Do not** run `npm run db:seed` against production — it
   refuses to run when `NODE_ENV=production` anyway.

## MCP server

### Endpoint

```
https://<your-deployment>/api/mcp
```

Locally: `http://localhost:3000/api/mcp`. It speaks streamable HTTP and requires
`Authorization: Bearer $MCP_TOKEN`. Requests without a valid token get `401` with a
`WWW-Authenticate` challenge and never reach a tool. If `MCP_TOKEN` is unset, every request is
rejected.

### Connecting from Claude Code

```bash
claude mcp add --transport http life-dashboard https://<your-deployment>/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

Then check it with `/mcp` inside Claude Code. For a local server, use
`http://localhost:3000/api/mcp`.

### Connecting from another MCP client

Any client that supports remote (streamable HTTP) servers with a static header works. The
equivalent JSON configuration is:

```json
{
  "mcpServers": {
    "life-dashboard": {
      "type": "http",
      "url": "https://<your-deployment>/api/mcp",
      "headers": { "Authorization": "Bearer <MCP_TOKEN>" }
    }
  }
}
```

Keep the token out of anything you commit — reference an environment variable where your client
supports it.

### Tools

**Read** (safe, never modify anything)

| Tool | Arguments | Returns |
| --- | --- | --- |
| `get_today` | — | Date, every active goal with current/target/status, day totals, workout, weight, next action |
| `get_goals` | — | All goals and their full configuration |
| `get_goal` | `goalId` | One goal plus progress for its current period |
| `get_food_log` | `date?` | Entries and totals for a day |
| `get_workout` | `date?` | Workouts with exercises, sets and the previous session per exercise |
| `get_weight_history` | `startDate`, `endDate` | Weigh-ins plus latest / 7-day average / change |
| `get_weekly_summary` | `weekStart?` | Averages, workouts, weight trend, per-goal adherence, streaks |

**Write** (modify persistent records; each writes an audit row)

| Tool | Arguments |
| --- | --- |
| `log_food` | `foodName`, `calories`, `protein?`, `carbs?`, `fat?`, `quantity?`, `unit?`, `mealType?`, `timestamp?`, `notes?` |
| `log_water` | `milliliters`, `timestamp?` |
| `log_weight` | `kilograms`, `timestamp?`, `note?` |
| `log_sleep` | `startTime`, `endTime`, `quality?`, `note?` |
| `log_workout` | `workoutName`, `date?`, `notes?`, `completed?` |
| `add_goal` | `name`, `type`, `period`, `description?`, `unit?`, `targetValue?`, `metricKey?`, `visibleOnDashboard?`, `showInChecklist?` |
| `update_goal` | `goalId` plus any fields to change |
| `remove_goal` | `goalId` (archives; past entries are kept) |
| `complete_goal` | `goalId`, `date?`, `value?` (manual goals only) |
| `add_note` | `note`, `date?` |

Every tool returns a one-line human summary *and* the same data as structured JSON.

### MCP safety properties

- No SQL, no shell, and no generic "execute" or "write anything" tool exists.
- All input is validated with Zod using the *same* schemas the web forms use, so malformed dates
  (`2026-02-30`), impossible numbers (negative calories, 900 kg, `NaN`, `Infinity`) and unknown
  enum values are rejected before any code runs.
- The user id comes from the verified token, never from tool arguments — no argument can reach
  another account's data (there is a test for this).
- Every mutation appends a row to `mcp_audit_log` with the tool name, the arguments as received,
  a summary and a timestamp.
- `complete_goal` refuses metric-backed goals, so a model cannot fake protein progress instead of
  logging the food.
- The server's instructions tell the model not to invent macronutrient values and to read current
  state before ambiguous or destructive changes.

## Monitor mode

`/monitor` is built for a second screen: a large clock, the date, the next action, goal progress,
workout status, weight and a weekly trend — no navigation. It polls `/api/monitor` once a minute
and shows a small "Reconnecting…" chip if a poll fails.

- Open it from the dashboard header (the monitor icon), or go to `/monitor` directly.
- The ⤢ button uses the browser's own Fullscreen API — no extension required.
- On Linux, drag the window to the second monitor and press `F11` (or use the ⤢ button) for a
  clean, always-on display. Dark mode is the intended look; light mode works too.

## Troubleshooting

**Every page errors, or sign-in fails.** The database is almost certainly not running — the
Docker container does not restart automatically after a reboot:

```bash
npm run db:up
```

The app now reports this explicitly ("Cannot reach the database…") rather than showing a blank
error. Confirm the connection independently with:

```bash
docker exec life-dashboard-db pg_isready -U postgres
```

**"Invalid environment configuration" on startup.** `.env.local` is missing or a value is too
short. Copy `.env.example` and regenerate the secrets with the `openssl` commands above.

**A relation does not exist.** Migrations have not been applied: `npm run db:migrate`. On a fresh
Vercel deployment this is the usual second step — the build succeeds without a database, but the
running app needs the schema.

**Port 3000 is taken.** `PORT=3001 npm run dev`.

## Security notes

- **This is a single-account app.** `AUTH_USERNAME`/`AUTH_PASSWORD` define the one account;
  there is no sign-up, and nothing is publicly readable. Every page is behind
  `src/proxy.ts`, which redirects to `/login` without a session cookie.
- The session is a `jose`-signed JWT in an `httpOnly`, `sameSite=lax`, `secure`-in-production
  cookie, valid for 30 days. `AUTH_SECRET` signs it; changing that secret invalidates every
  session.
- Credentials and the MCP token are compared with `timingSafeEqual`.
- Secrets are read only through `src/lib/env.ts`, which imports `server-only` — they can never be
  bundled into client code.
- Every query is scoped by `userId`, so the data model is multi-user-safe even though the
  deployment serves one person.
- `robots` is set to `noindex, nofollow`.
- If you rotate `MCP_TOKEN`, update your MCP client configuration; old tokens stop working
  immediately.

## Adding a goal type or metric

**A new automatic metric** (progress derived from logged data) is a three-line change:

1. Add the key to `METRIC_KEYS` in `src/lib/domain.ts`.
2. Add the field it reads to `DayFacts` in `src/lib/metrics.ts` (if it is not already there), and
   populate it in `loadDayFacts` in `src/server/services/day.ts`.
3. Add an entry to the `METRICS` registry in `src/lib/metrics.ts` with a label, default unit,
   suggested goal type, and an aggregation of `sum` or `latest`.

The new metric immediately appears in the "Tracked from" dropdown when creating a goal, in the
dashboard, in the weekly review, and in `add_goal` over MCP. No UI change is needed.

**A new goal type** (a new way of interpreting a target):

1. Add it to `GOAL_TYPES` in `src/lib/domain.ts`.
2. If it needs special target handling, extend `effectiveTarget` in `src/lib/goals.ts`
   (`boolean`, for example, defaults to a target of 1).
3. If it should behave differently in the "next action" suggestion, add or reorder a strategy in
   `DEFAULT_STRATEGIES` in `src/lib/next-action.ts`.
4. Optionally give it a quick-add affordance in `src/components/dashboard/goal-quick-add.tsx`.

Goal types and periods are stored as text columns validated by Zod, so adding one needs no
database migration.

## Architecture notes

```
src/
  app/            routes: (app) group = authenticated shell, /login, /monitor, /api/*
  components/     ui/ (shadcn), plus feature folders: dashboard, goals, food, body, workouts, log, charts
  db/             Drizzle schema and client
  lib/            pure business logic — no database imports, fully unit-tested
  mcp/            MCP auth, context, schemas, tools, registration
  server/         auth, services (data access + orchestration), server actions
```

Three rules keep it coherent:

1. **Calculations live in `src/lib` and are pure.** `DayFacts` → goal progress → summaries. The
   database layer produces `DayFacts`; everything downstream is arithmetic. That is why the tests
   need no mocks.
2. **Daily totals are never stored.** Every event row carries an absolute `occurredAt` *and* a
   `localDate` bucket computed in the user's timezone. Totals are recomputed from events in one
   place (`loadDayFacts`), so the dashboard, the weekly review and MCP can never disagree.
3. **The web app and MCP share the service layer and the Zod schemas.** A server action and a
   tool call end up in the same function with the same validation.
