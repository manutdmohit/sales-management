# Inventory & Sales Management Platform

Enterprise inventory and POS platform based on [docs/design_v2_enterprise.md](./docs/design_v2_enterprise.md).

## Architecture

```
Next.js UI → API Routes → Services → Domain (Inventory Engine) → Repositories → Mongoose → MongoDB
```

**Golden rule:** stock is never stored directly. It is calculated from immutable inventory transactions.

## Phase 1 (implemented)

- Multi-business (tenant) model
- Products, purchases, sales
- Ledger-based inventory engine
- REST API under `/api/*`
- Dashboard, POS, inventory, products, purchases, reports UI shells

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)

## Setup

```bash
cd inventory-platform
cp .env.example .env.local
# Edit MONGODB_URI in .env.local

npm install
npm run seed:admin
npm run dev
```

Create the default admin (`admin@inventory.local` / `admin123` unless overridden in `.env`). Then open [http://localhost:3000](http://localhost:3000) — you will be redirected to **Login**.

In another terminal, seed demo data (dev server must be running):

```bash
npm run seed
```

Open [http://localhost:3000](http://localhost:3000) and select **Pharmacy** from the business selector.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/businesses` | List / create businesses (`?all=true` includes inactive) |
| GET/PATCH/DELETE | `/api/businesses/:id` | Get / update / deactivate business |
| GET/POST | `/api/products?businessId=` | List / create products |
| GET/PATCH | `/api/products/:id` | Get / update product |
| GET | `/api/inventory?businessId=` | Stock summary |
| GET | `/api/inventory?businessId=&productId=` | Single product stock |
| POST | `/api/inventory/transactions` | Stock adjustment |
| GET/POST | `/api/sales?businessId=` | List / create sale (deducts stock) |
| GET/POST | `/api/purchases?businessId=` | List / create purchase (adds stock) |
| GET | `/api/reports?businessId=&kind=sales\|purchases&period=` | Sales/purchase analytics (`daily`, `weekly`, `monthly`, `custom` + `from`/`to`) |
| POST | `/api/auth/login` | Sign in (sets session cookie) |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/me` | Current user profile |

## Project structure

```
src/
  domain/           # Types + inventory engine (pure logic)
  services/         # Business logic orchestration
  models/           # Mongoose schemas and models
  repositories/     # Data access (Mongoose queries + aggregations)
  schemas/          # Zod validation
  app/api/          # REST route handlers
  app/(app)/        # UI pages
  lib/              # DB, events, errors
docs/               # Architecture design document
scripts/seed.ts     # Demo data seeder
```

## Roadmap (from design)

- **Phase 2:** Expiry alerts, advanced reports
- **Phase 3:** POS optimization, barcode, mobile
- **Phase 4:** Multi-warehouse, offline, accounting

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run seed` | Seed demo businesses/products (requires `npm run dev`) |
| `npm run lint` | ESLint |
