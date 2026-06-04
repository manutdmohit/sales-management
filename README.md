# Inventory & Sales Management Platform

Multi-business inventory, POS, manufacturing, and service booking platform. Architecture is documented in [docs/design_v2_enterprise.md](./docs/design_v2_enterprise.md).

## Architecture

```
Next.js UI → API Routes → Services → Domain → Repositories → Mongoose → MongoDB
```

**Golden rule:** stock is never stored directly on products. It is derived from immutable inventory transactions (purchases, sales, production, write-offs).

## Features

- **Multi-business tenants** — switch businesses in the header; features vary by business type
- **Ledger inventory** — purchases, sales, adjustments, production consume/output, expiry write-offs
- **Batch & expiry tracking** — per-product flag; batches on purchase receive and production output
- **POS** — cart, checkout, cash/credit, receipt upload
- **Purchases & suppliers** — receive stock with optional batch/expiry per line
- **Manufacturing** (manufacturer businesses) — recipes, production runs, finished-goods batches
- **Clients & receivables** — customer ledger, credit sales, booking payments, unified receivables
- **Services & appointments** (service/retail businesses) — booking calendar, appointment payments
- **Reports, notifications, email reminders** — in-app alerts + optional Resend email
- **Admin** — businesses, team, settings

## Demo businesses

After `npm run seed`, two businesses are available:

| Business | Type | Highlights |
|----------|------|------------|
| **Vedic (VED)** | Manufacturing | Raw materials → production → cookies & noodles; batch expiry on all products; demo purchase lots + production batches |
| **Magic Touch (MT)** | Service & retail | Skincare products, salon services, appointments |

Default logins (override via env — see [`.env.example`](./.env.example)):

- Admin: `admin@inventory.local` / `admin123`
- Staff: `staff@inventory.local` / `staff123`

## Prerequisites

- Node.js 20+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

## Setup

```bash
cp .env.example .env.local
# Set MONGODB_URI (and AUTH_SECRET before production)

npm install
npm run seed:admin   # create admin + staff users
npm run seed         # demo businesses, products, production, batch expiry data
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in. Use the business selector to switch between **Vedic** and **Magic Touch**.

### Batch expiry (Vedic)

1. **Products** — *Track batch expiry* is enabled on Vedic demo products
2. **Purchases** — enter **Batch #** and **Expiry date** when receiving raw materials
3. **Manufacturing** — enter **Output batch #** and **Best before** when recording a run
4. **Inventory** — view expiry alerts and write off expired or damaged lots

To refresh batch demo data on an existing database:

```bash
npm run backfill:vedic-batches
```

## Environment variables

Copy [`.env.example`](./.env.example) to `.env.local`. Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | No | Database name (default `inventory_platform`) |
| `AUTH_SECRET` | Production | Session signing secret |
| `ADMIN_*` / `STAFF_*` | No | Credentials for `npm run seed:admin` |
| `CRON_SECRET` | Production cron | Secures `/api/cron/reminders` |
| `REMINDER_TIMEZONE` | No | Calendar timezone for reminders (default `Asia/Kathmandu`) |
| `RESEND_*` / `NOTIFICATION_EMAIL` | No | Outbound email |
| `CLOUDINARY_*` | No | Payment/purchase receipt uploads |
| `APP_URL` | No | Base URL for links in emails |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run seed:admin` | Create admin and staff users |
| `npm run seed` | Seed demo businesses, products, production, and batch data |
| `npm run backfill:vedic-batches` | Enable Vedic expiry tracking, demo purchase lots, production output batches |
| `npm run backfill:production` | Backfill production run costs / demo runs |
| `npm run backfill:product-costs` | Backfill unit costs and sale COGS |
| `npm run backfill:clients` | Link historical sales to client records |
| `npm run reminders` | Run credit reminders + expiry alerts locally |
| `npm run test:email` | Send a test email via Resend |

## Scheduled jobs (Vercel)

[`vercel.json`](./vercel.json) schedules `GET /api/cron/reminders` daily at `15 0 * * *` (00:15 UTC, ~6:00 AM Asia/Kathmandu). The job runs **credit reminders** and **batch expiry alerts** (in-app notifications + optional email).

### Before it will run

Cron jobs only execute on **Production** deployments (not preview). You must set these in Vercel → Project → Settings → Environment Variables (**Production**):

| Variable | Why |
|----------|-----|
| `CRON_SECRET` | Random string (16+ chars). Vercel sends `Authorization: Bearer <CRON_SECRET>` when invoking the cron. Without it, the route returns **401**. |
| `MONGODB_URI` | Handler connects to MongoDB on each run. |
| `AUTH_SECRET` | Required for the app in production (unrelated to cron auth, but needed for deploy). |

Also ensure MongoDB Atlas (or your host) allows connections from Vercel (e.g. `0.0.0.0/0` on Atlas Network Access).

### Verify cron on Vercel

After a **production** deploy:

1. **Cron Jobs tab** — Vercel dashboard → your project → **Cron Jobs**. Confirm `/api/cron/reminders` is listed with schedule `15 0 * * *`.
2. **Manual run** — Use **Run** on that cron (if available) or trigger from the deployment’s function logs.
3. **Production URL test** — From a machine with your secret (never commit this):

   ```bash
   curl -sS -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://YOUR-APP.vercel.app/api/cron/reminders
   ```

   Expect **200** and JSON like `{ "data": { "reminders": …, "expiry": … } }`. **401** means `CRON_SECRET` is missing or wrong. **504** means the function timed out (see limits below).

4. **Function logs** — Project → **Logs**, filter path `/api/cron/reminders`. Check status, duration, and errors after the scheduled run.

5. **In-app** — Next day, confirm expiry or credit notifications appear (and email if `RESEND_API_KEY` is set).

### Plan limits

| | Hobby | Pro |
|---|--------|-----|
| Schedule | Once per day max (this project’s schedule is OK) | Finer schedules allowed |
| Timing | May run anytime within the scheduled **hour** (not necessarily at :15) | Minute-level precision |
| Timeout | Route sets `maxDuration = 60` (Hobby max 60s) | Up to 300s+ configurable |

Vercel does **not** retry failed cron runs. Use logs to debug; run `npm run reminders` locally against the same database if needed.

### Local / CI (no Vercel cron)

```bash
npm run reminders
# or hit the API route locally:
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
```

`npm run reminders` calls the same services directly (no HTTP auth required).

## API overview

REST handlers live under `src/app/api/`. Common patterns:

- `?businessId=` — scope to a tenant
- `?page=` / `?pageSize=` — pagination on list endpoints

| Area | Endpoints |
|------|-----------|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` |
| Businesses | `GET/POST /api/businesses`, `GET/PATCH/DELETE /api/businesses/:id` |
| Products & categories | `/api/products`, `/api/categories` |
| Inventory | `GET /api/inventory`, `GET /api/inventory/expiring`, `POST /api/inventory/transactions`, `POST /api/inventory/write-offs` |
| Sales & receivables | `/api/sales`, `/api/sales/receivables`, `/api/sales/:id`, `/api/sales/:id/payment` |
| Purchases & suppliers | `/api/purchases`, `/api/suppliers` |
| Manufacturing | `GET/POST /api/manufacturing` |
| Clients | `/api/clients`, `/api/clients/:id`, purchases/bookings sub-routes |
| Services & appointments | `/api/services`, `/api/appointments`, payment routes |
| Reports | `GET /api/reports?kind=sales\|purchases&period=` |
| Notifications | `/api/notifications` |
| Cron | `GET/POST /api/cron/reminders` |

## Project structure

```
src/
  app/(app)/        # UI pages (POS, inventory, manufacturing, …)
  app/api/          # REST route handlers
  components/       # Shared UI
  domain/           # Types, capabilities, expiry rules
  services/         # Business logic
  repositories/     # MongoDB access
  models/           # Mongoose schemas
  schemas/          # Zod validation
  lib/              # DB, auth, email, events
scripts/            # Seed and backfill utilities
docs/               # Design document
```

## Deployment notes

1. Create a MongoDB Atlas cluster and set `MONGODB_URI`
2. Set `AUTH_SECRET` and `CRON_SECRET` in production
3. Deploy to Vercel (or similar); cron is configured in `vercel.json`
4. Run `npm run seed:admin` and optionally `npm run seed` against the production database (one-time, from a secure environment)

Optional: configure Resend and Cloudinary for email reminders and receipt uploads.

## Roadmap

See [docs/design_v2_enterprise.md](./docs/design_v2_enterprise.md) for Phase 3+ items (barcode POS, multi-warehouse, offline, accounting integrations).
