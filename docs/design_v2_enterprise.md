# Inventory & Sales Management Platform
## Production-Grade Architecture Design Document

Version: 2.0 (Enterprise)

---

# 1. System Vision

A scalable, modular, multi-business inventory and sales management platform designed for long-term enterprise use.

It supports:

- Multiple businesses (Magic Touch, Vedic, Pharmacy, etc.)
- Full inventory lifecycle tracking
- Ledger-based stock system (audit-safe)
- Real-time sales (POS)
- Batch + expiry tracking
- Reporting & analytics
- Future expansion (mobile, offline, multi-warehouse)

---

# 2. Architecture Overview

## High-Level Architecture

Client (Next.js UI)
        ↓
API Layer (Route Handlers / Server Actions)
        ↓
Service Layer (Business Logic)
        ↓
Domain Layer (Inventory Engine)
        ↓
Repository Layer (MongoDB Access)
        ↓
MongoDB

---

## Design Philosophy

- Domain-driven design (DDD-lite)
- Modular monolith (scalable to microservices later)
- Event-driven inventory updates (internally)
- Zero hardcoded business logic
- Fully auditable system

---

# 3. Core Domain Model

## 3.1 Business (Tenant Model)

Represents independent business units.

Fields:
- id
- name
- slug
- code
- isActive
- settings
- createdAt

---

## 3.2 Product Domain

Product is NOT stock.

Product is a definition.

Fields:
- id
- businessId
- categoryId
- name
- slug
- sku
- unitId
- pricing (purchase/selling)
- trackExpiry
- minStock
- isActive

---

## 3.3 Inventory Domain (Core Engine)

### Golden Rule:
> Inventory is NEVER stored. It is calculated from transactions.

---

## Inventory Transaction Model

Types:
- PURCHASE (+)
- SALE (-)
- ADJUSTMENT (+/-)
- DAMAGE (-)
- RETURN (+)
- EXPIRED (-)

Fields:
- id
- businessId
- productId
- batchId
- type
- quantity
- referenceId
- timestamp

---

## Inventory Calculation

Stock formula:

Stock = SUM(all transactions grouped by product)

---

# 4. Batch & Expiry System

## Batch Model

Each stock entry is tracked via batch:

Fields:
- batchNumber
- productId
- expiryDate
- quantity
- remainingQuantity

---

## Expiry Engine

Runs scheduled job:

- Checks expiryDate
- Triggers alerts if:
  - < 30 days → WARNING
  - expired → CRITICAL

---

# 5. Sales System (POS Engine)

## Flow

Product → Cart → Checkout → Sale Record → Inventory Deduction

---

## Sale Model

- invoiceNumber
- businessId
- total
- discount
- tax
- paymentMethod
- items[]

---

## POS Requirements

- Fast search (≤ 300ms)
- Keyboard optimized
- Offline tolerance (future)
- Instant cart updates

---

# 6. Purchase System

## Flow

Supplier → Purchase → Stock In → Inventory Transaction Created

---

## Purchase Rules

On purchase save:
- Create purchase record
- Create batch (if expiry tracked)
- Create inventory transaction (PURCHASE)

---

# 7. Multi-Business System

## Business Isolation Rule

Every record MUST include:

- businessId

Used for:

- filtering
- reporting
- access control

---

## Future Expansion Ready

- Multi-branch support
- Multi-warehouse support
- Franchise model

---

# 8. Service Layer Design

## Modules

- BusinessService
- ProductService
- InventoryService
- SalesService
- PurchaseService
- ReportService

---

## Example: InventoryService

Responsibilities:

- Add transaction
- Calculate stock
- Validate stock availability
- Trigger alerts
- Maintain consistency

---

# 9. Repository Layer

Abstract DB access:

Example:

- product.repository.ts
- inventory.repository.ts

Rules:

- NO business logic here
- Only CRUD + aggregation

---

# 10. API Design

## REST Structure

/ api / businesses
/ api / products
/ api / inventory
/ api / sales
/ api / purchases

---

## Example Endpoints

POST /sales → create sale + deduct stock  
POST /purchases → add stock  
GET /inventory → aggregated stock  

---

# 11. Performance Strategy

## Indexing (Critical)

MongoDB indexes:

- businessId
- productId
- createdAt
- batchId

---

## Aggregation Optimization

Precompute:

- daily sales
- inventory summary

Optional cache layer:

- Redis (future)

---

# 12. Security Model

- Role-based access control (RBAC)
- JWT session
- Business-level isolation
- Audit logging for all writes

---

# 13. UI/UX Architecture

## Design System

- ShadCN UI
- Tailwind
- Radix primitives

---

## UI Principles

- Command-driven interface
- Drawer-based forms
- Minimal navigation depth
- POS optimized separately

---

## Key Screens

- Dashboard
- POS Screen
- Inventory Screen
- Product Detail Page
- Reports Dashboard

---

# 14. Reporting Engine

## Types

- Sales Reports
- Inventory Reports
- Business Comparison
- Profit Analysis (future)

---

## Aggregation Strategy

- MongoDB aggregation pipelines
- Precomputed snapshots (future optimization)

---

# 15. Event Flow System (Internal)

Events:

- SALE_CREATED
- PURCHASE_CREATED
- STOCK_UPDATED
- PRODUCT_EXPIRED

Used for:

- Alerts
- Logs
- Reports

---

# 16. Scalability Strategy

## Phase 1

Monolith (current)

## Phase 2

Modular services split

## Phase 3

Microservices (optional future)

---

# 17. Failure Handling

- Retry failed transactions
- Idempotent APIs
- Safe stock recalculation
- Audit trail recovery

---

# 18. Data Integrity Rules

- No direct stock updates
- All stock changes via transactions
- No orphan purchases/sales
- Immutable transaction history

---

# 19. Development Roadmap

Phase 1:
- Core inventory engine
- Sales + purchases
- Business system

Phase 2:
- Expiry system
- Alerts
- Reports

Phase 3:
- POS optimization
- Barcode scanning
- Mobile support

Phase 4:
- Multi-warehouse
- Offline mode
- Accounting integration

---

# 20. Success Definition

System is successful if:

- New business added in < 2 minutes
- Stock accuracy = 100%
- No manual stock editing required
- Reports are real-time
- System supports 10,000+ products smoothly
