# ⚡ PowerGridBD — Backend

A production-grade REST API for a **load-shedding and power-outage management system**. Customers report outages and track restoration, technicians resolve assigned faults, power operators manage the grid hierarchy and load-shedding schedules, and admins oversee users, payments, and platform-wide analytics. Payments run through **SSLCommerz** (priority restoration passes and SLA subscriptions).

> Backend only. Pairs with a separate frontend client (see `FRONTEND_URL`).

**Live Backend URL:** https://powergridbd-backend.vercel.app/

---

## ✨ Badges

![Node](https://img.shields.io/badge/Node-20%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7.10-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-OTP%20%26%20cache-DC382D?logo=redis&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT%20httpOnly-000000?logo=jsonwebtokens&logoColor=white)
![Zod](https://img.shields.io/badge/Validation-Zod-3E67B1?logo=zod&logoColor=white)
![Biome](https://img.shields.io/badge/Lint%2FFormat-Biome-60A5FA)

---

## 📚 Table of Contents

- [🚀 Core Features](#-core-features)
- [🧰 Tech Stack](#-tech-stack)
- [🏗️ Architecture & Modules](#️-architecture--modules)
- [🔐 Authentication & Authorization](#-authentication--authorization)
- [💳 Payments (SSLCommerz)](#-payments-sslcommerz)
- [📊 Analytics & Audit](#-analytics--audit)
- [🔌 API Endpoint Reference](#-api-endpoint-reference)
- [🔍 Pagination, Search, Filtering & Sorting](#-pagination-search-filtering--sorting)
- [🗄️ Database](#️-database)
- [🔐 Environment Variables](#-environment-variables)
- [⚙️ Getting Started](#️-getting-started)
- [📜 Scripts](#-scripts)
- [📁 Project Structure](#-project-structure)
- [🛡️ Error Handling & Standards](#️-error-handling--standards)

---

## 🚀 Core Features

- **OTP-based registration** — 6-digit OTP stored in Redis (short TTL), delivered by email via Nodemailer + EJS templates; verification creates the account and issues tokens.
- **Google OAuth login** — ID-token verification via `google-auth-library`; creates the user on first login.
- **Role-based access control** — `CUSTOMER`, `TECHNICIAN`, `POWER_OPERATOR`, `ADMIN` enforced by the `auth(...roles)` guard on every route, with blocked-account rejection.
- **Grid hierarchy management** — Zones → Substations → Feeders → Areas with scoped name uniqueness and full CRUD.
- **Outage lifecycle** — customers report → operators assign technicians (`ASSIGNED`, `assignedAt` stamped) → status advances to `IN_PROGRESS` → `RESOLVED` (`resolvedAt` stamped).
- **Load-shedding schedules** — operators publish feeder/area schedules with date-range querying.
- **SSLCommerz payments** — priority restoration passes and 30-day SLA subscriptions, with IPN + success/fail/cancel callbacks, a multi-strategy validation cascade, and refunds. Confirmation and refunds run inside `prisma.$transaction`.
- **Dashboard analytics** — operational, performance (MTTR, assignment time, workload), geographical, financial, and trend analytics plus role-scoped customer/technician summaries.
- **Audit trail** — payment completions/refunds, user role/status changes, and outage assignment/status changes are recorded in `AuditLog` (queryable by admins).
- **Profile images** — Multer (memory storage) → Cloudinary, with old-image cleanup.

---

## 🧰 Tech Stack

| Category | Package | Purpose |
|---|---|---|
| Framework | `express` ^5.2.1 | HTTP server |
| Language | `typescript` ^7.0.2 | Static typing (`strict: true`) |
| ORM | `prisma` + `@prisma/client` ^7.10.0 | PostgreSQL access |
| DB driver | `@prisma/adapter-pg` + `pg` | Required Prisma 7 driver adapter |
| Auth | `jsonwebtoken`, `bcryptjs`, `google-auth-library` | JWT, password hashing, Google OAuth |
| Validation | `zod` ^4.5.4 | Request schema validation |
| Cache | `redis` ^6.2.1 | OTP storage |
| Email | `nodemailer`, `ejs` | SMTP transport + email templates |
| Uploads | `cloudinary`, `multer` | Media storage + multipart parsing |
| Payments | native `fetch` | SSLCommerz integration (no payment SDK) |
| Runtime utils | `cookie-parser`, `cors`, `http-status`, `dotenv` | Cookies, CORS, status codes, env |
| Dev | `tsx`, `tsup` | Watch runner, bundler (ESM + CJS) |
| Lint/Format | `@biomejs/biome` ^2.5.11 | Linter + formatter (tabs, double quotes) |
| Deploy | `vercel.json` | Vercel build from source (`dist/server.js`) |

---

## 🏗️ Architecture & Modules

Layered feature modules under `src/app/module/<feature>/`, each with `*.route.ts` → `*.controller.ts` → `*.service.ts`, plus `*.interface.ts` (types) and `*.validation.ts` (Zod schemas). **Controllers never call Prisma; services never touch `req`/`res`.**

Entry flow: `src/server.ts` (connects PostgreSQL → connects Redis → verifies SMTP → auto-seeds 3 users → `app.listen`) → `src/app.ts` (Express app, all routes mounted under `/api/v1`).

| Module | Base path | What it does |
|---|---|---|
| auth | `/api/v1/auth` | Register, email OTP verify, login, me, refresh-token, Google login, forgot/reset password |
| user | `/api/v1/user` | Profile image upload, profile update, admin user CRUD, status/role update, soft delete |
| grid | `/api/v1/grid` | Zone / substation / feeder / area CRUD (admin + operator writes, all roles read) |
| outage | `/api/v1/outage` | Report outages, assign technicians, update status, role-scoped listing |
| schedule | `/api/v1/schedule` | Create and manage load-shedding schedules |
| payment | `/api/v1/payment` | Initiate, IPN, success/fail/cancel callbacks, lookup, my-payments, refund |
| analytics | `/api/v1/analytics` | Operational, performance, geographical, financial, trends, summaries, audit logs |
| application | `/api/v1/applications` | Technician onboarding: public apply, email-OTP verify, admin/operator review |

Shared code: `src/app/config` (central env access), `src/app/lib` (prisma, redis, cloudinary, multer, nodemailer, googleAuth, sslcommerz), `src/app/middleware` (checkAuth, validateRequest, globalErrorHandler, notFound, requestLogger), `src/app/utils` (AppError, catchAsync, jwt, sendResponse, seed, pagination, audit), `src/app/interfaces` (`IQuery`, pagination meta/result types), `src/app/templates` (EJS emails).

---

## 🔐 Authentication & Authorization

- JWT **access + refresh tokens** delivered as **httpOnly cookies** (and `Authorization: Bearer` is also accepted by the guard).
- Registration is OTP-based: `POST /auth/register` stores a 6-digit OTP + pending user data in Redis and emails it; `POST /auth/verify-email` creates the user and returns tokens.
- Password recovery uses the same OTP pattern (`forgot-password` → `reset-password`) plus a confirmation email.
- The `auth(...roles)` middleware verifies the token, loads the user from the DB on every request, rejects `BLOCKED` accounts, and enforces role membership — returns `401`/`403` otherwise.
- On every boot the server **auto-seeds** three users (idempotent, skipped if they exist): Admin, Power Operator, and Technician, from the `TESTER_*` env vars.

| Role | Typical capabilities |
|---|---|
| `CUSTOMER` | Report outages, buy priority/SLA, view own reports & payments & summary |
| `TECHNICIAN` | View/update assigned outages, view technician summary. Obtained via the application flow (`POST /applications` → email verify → admin/operator approval) or direct grant |
| `POWER_OPERATOR` | Grid CRUD, assign technicians, manage schedules, view analytics, review technician applications, grant/revoke only the `TECHNICIAN` role |
| `ADMIN` | Everything + user management, audit logs |

`POWER_OPERATOR` is never publicly obtainable — seeded at boot and granted by admins only. All notification emails (role changes, outage lifecycle, payment receipts, schedule notices) are best-effort and never block the request.

---

## 💳 Payments (SSLCommerz)

Native-`fetch` integration in `src/app/lib/sslcommerz.ts` — **no third-party payment SDK**. Sandbox base `https://sandbox.sslcommerz.com`, live `https://securepay.sslcommerz.com` (toggled by `SSLC_IS_LIVE`).

Two payment types (`PaymentType`) with server-enforced prices (`PRIORITY_RESTORATION_PRICE` / `SLA_SUBSCRIPTION_PRICE` in BDT — client-sent amounts must match exactly):
- **`PRIORITY_RESTORATION`** — linked to one of the customer's own outage reports; on success the report becomes `isPriority: true` and jumps to the top of every staff work queue (operator/technician lists sort priority first).
- **`SLA_SUBSCRIPTION`** — standalone 30-day commercial coverage (`slaActive: true` + `slaExpiryDate`); every new outage the subscriber reports is automatically flagged priority, with a 7-day expiry warning email and auto-deactivation at expiry.

How confirmation works:
1. `POST /payment` creates a `PENDING` payment, opens an SSLCommerz session, and returns `{ transactionId, gatewayUrl }`.
2. SSLCommerz POSTs to `/payment/success|fail|cancel` (callback URLs are built from `BACKEND_URL`, which must be **publicly reachable** — on localhost only the browser-redirected callbacks fire; IPN never arrives).
3. The success handler confirms via a cascade: `validateOrder(val_id)` → trust the signed POST `status=VALID` → `validateBySessionKey(sessionkey)` → `queryByTranId` fallback.
4. Confirmation and refunds execute inside `prisma.$transaction` (payment update + side effects + `AuditLog` write atomically; SSLCommerz API calls stay outside the transaction).
5. `paymentDetails` stores only `{ sessionkey, status, store_id, failedreason }` plus `validation`/`refund` sub-objects — never the full initiation response.

Refunds (`POST /payment/refund`) revert the side effects (`isPriority: false`, SLA deactivated) and are recorded in the audit trail.

---

## 📊 Analytics & Audit

Mounted at `/api/v1/analytics` (operator/admin unless noted):

| Endpoint | Access | Contents |
|---|---|---|
| `GET /operational` | Admin, Operator | Active + priority outage counts, available technicians, active/upcoming schedules, critical feeders down |
| `GET /performance` | Admin, Operator | MTTR, avg assignment time, per-technician workload distribution, first-time-fix rate |
| `GET /geographical` | Admin, Operator | Outage summary by area and zone, top-10 worst feeders |
| `GET /financial` | Admin, Operator | Total revenue, revenue by payment type, success rate, payments by status, active SLA subscriptions |
| `GET /trends?days=30` | Admin, Operator | Outage/complaint volume per day (`days` 7–365), peak load-shedding hours |
| `GET /my-summary` | Customer | Own reports by status, priority count, total paid |
| `GET /technician-summary` | Technician | Assigned/ongoing/resolved counts, avg resolution time |
| `GET /audit-logs` | Admin | Paginated audit trail, filterable by `entity`/`action` |

> First-time-fix rate is approximated as `RESOLVED / (RESOLVED + CANCELLED)` since reassignment history is not tracked.

---

## 🔌 API Endpoint Reference

Base URL: `http://localhost:5000/api/v1` · Production: `https://powergridbd-backend.vercel.app/api/v1` · Health check: `GET /`

**Access legend:** 🟢 Public · 🔵 Customer · 🟠 Technician · 🟣 Admin · 🟡 Operator · 🟤 Any authenticated user

### Auth — `/auth`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/register` | 🟢 | Register customer, sends OTP email |
| POST | `/verify-email` | 🟢 | Verify OTP → creates account + tokens |
| POST | `/login` | 🟢 | Credentials login → tokens (httpOnly cookies) |
| GET | `/me` | 🟤 | Current user profile |
| POST | `/refresh-token` | 🟢 | Rotate access + refresh tokens |
| POST | `/google` | 🟢 | Google ID-token login / register |
| POST | `/forgot-password` | 🟢 | Send password-reset OTP |
| POST | `/reset-password` | 🟢 | Reset password with OTP |

### User — `/user`

| Method | Path | Access | Description |
|---|---|---|---|
| PATCH | `/profile-image` | 🟤 | Upload profile image (multipart field `profileImage`) |
| PATCH | `/profile` | 🟤 | Update own name/phone/address |
| GET | `/` | 🟣 | All users (paginated, search, filter) |
| GET | `/:id` | 🟣 | Single user |
| PATCH | `/:id/status` | 🟣 | Update status (`ACTIVE`/`BLOCKED`) |
| PATCH | `/:id/role` | 🟣 | Update role |
| DELETE | `/:id` | 🟣 | Soft delete (`isDeleted`, status `BLOCKED`) |

### Grid — `/grid`

Writes: 🟣🟡 · Reads: 🟤. Resources: `/zones`, `/substations`, `/feeders`, `/areas` — each with `POST /<resource>` (create), `GET /<resource>` (paginated list), `PATCH /<resource>/:id` (update), `DELETE /<resource>/:id` (delete). Names are unique within their parent (e.g. same substation name can exist in different zones, but not twice in one zone).

### Outage — `/outage`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 🔵 | Report an outage (`description`, `areaId`) |
| GET | `/` | 🟤 | List reports (role-scoped: own / assigned / all) |
| GET | `/:id` | 🟤 | Single report with full grid hierarchy (ownership-checked) |
| PATCH | `/:id/assign` | 🟣🟡 | Assign technician (stamps `assignedAt`, status → `ASSIGNED`) |
| PATCH | `/:id/status` | 🟣🟡🟠 | Update status (technicians: own tasks only; `RESOLVED` stamps `resolvedAt`) |
| DELETE | `/:id` | 🟣🟡🔵 | Delete (customers: own `PENDING` reports only) |

### Schedule — `/schedule`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 🟣🟡 | Create schedule (requires `feederId` or `areaId`) |
| GET | `/` | 🟤 | List schedules (paginated, filtered) |
| GET | `/:id` | 🟤 | Single schedule |
| PATCH | `/:id/status` | 🟣🟡 | Update schedule status |
| DELETE | `/:id` | 🟣🟡 | Delete schedule |

### Payment — `/payment`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 🔵 | Initiate payment → returns `{ transactionId, gatewayUrl }` |
| POST | `/ipn` | 🟢 | SSLCommerz IPN handler |
| POST | `/success` | 🟢 | SSLCommerz success callback → confirms payment, redirects to frontend |
| POST | `/fail` | 🟢 | SSLCommerz fail callback |
| POST | `/cancel` | 🟢 | SSLCommerz cancel callback |
| GET | `/transaction/:id` | 🟤 | Payment lookup by `tran_id` |
| GET | `/my-payments` | 🔵 | Own payment history (paginated) |
| POST | `/refund` | 🔵 | Refund own completed payment |

### Analytics — `/analytics`

See [📊 Analytics & Audit](#-analytics--audit). Operator/admin endpoints plus `GET /my-summary` (🔵) and `GET /technician-summary` (🟠).

### Applications — `/applications`

| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/` | 🟢 | Apply as technician (name, email, phone, experience…) |
| POST | `/verify-email` | 🟢 | Verify application OTP (1-hour TTL) |
| POST | `/resend-otp` | 🟢 | Resend verification OTP |
| GET | `/my?email=` | 🟢 | Check own application status |
| GET | `/` | 🟣🟡 | List applications (paginated, filter by `status`) |
| PATCH | `/:id/review` | 🟣🟡 | Approve (creates `TECHNICIAN` user, emails temp password) or reject (reason required) |

---

## 🔍 Pagination, Search, Filtering & Sorting

Every list endpoint accepts common query params and returns a `meta` envelope:

```http
GET /api/v1/outage?searchTerm=dhaka&status=PENDING&page=2&limit=20&sortBy=reportedAt&sortOrder=desc
```

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Outage reports retrieved successfully",
  "meta": { "page": 2, "limit": 20, "total": 87, "totalPages": 5 },
  "data": [ "..." ]
}
```

| Endpoint | `searchTerm` targets | Filters | Default sort |
|---|---|---|---|
| `GET /user` | name, email | `role`, `status` | `createdAt` desc |
| `GET /grid/zones` | name | — | `createdAt` desc |
| `GET /grid/substations` | name | `zoneId` | `createdAt` desc |
| `GET /grid/feeders` | name | `substationId` | `createdAt` desc |
| `GET /grid/areas` | name | `feederId` | `createdAt` desc |
| `GET /outage` | description, customer, area | `status`, `areaId`, `isPriority`, `from`, `to` | `reportedAt` desc |
| `GET /schedule` | title, reason | `status`, `type`, `feederId`, `areaId`, `from`, `to` | `startTime` desc |
| `GET /payment/my-payments` | — | `status`, `type` | `createdAt` desc |
| `GET /analytics/audit-logs` | — | `entity`, `action` | `createdAt` desc |

`limit` is clamped to 100. Services build filters as an `AND` conditions array (role scope first), then run `findMany` + `count` in `Promise.all`.

---

## 🗄️ Database

PostgreSQL via **Prisma 7** (mandatory `@prisma/adapter-pg` driver adapter, wired in `src/app/lib/prisma.ts`). Multi-file schema under `prisma/schema/` — one file per model, enums in `enum.prisma`:

```
Zone 1──* Substation 1──* Feeder 1──* Area 1──* User / OutageReport / Schedule
User 1──* OutageReport (as customer, as technician) · 1──* Payment · 1──* Schedule (creator)
OutageReport 1──* Payment · User 1──* AuditLog
```

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | Roles/status, soft delete, Cloudinary image, `slaActive`/`slaExpiryDate` |
| `Zone` / `Substation` / `Feeder` / `Area` | `zones`, `substations`, `feeders`, `areas` | Grid hierarchy, scoped name uniqueness |
| `OutageReport` | `outage_reports` | Status lifecycle, `isPriority`, `reportedAt`/`assignedAt`/`resolvedAt` |
| `Schedule` | `schedules` | Load-shedding windows (`type`, `status`), feeder/area scope |
| `Payment` | `payments` | `type` (`PRIORITY_RESTORATION`/`SLA_SUBSCRIPTION`), `status`, minimal `paymentDetails` JSON |
| `AuditLog` | `audit_logs` | `action`, `entity`, `entityId`, `actorId`, `metadata` |

- Generated client is custom-output at `src/generated/prisma` **and committed** — re-run `npx prisma generate` after schema changes and commit the output. Import client/enums from `src/generated/prisma/...`, never from `@prisma/client`.
- Prisma config file is `prisma7.config.ts`. Migrations live in `prisma/migrations/` (5 applied, latest adds payment types + SLA fields).
- ⚠️ The migration for scoped uniques, composite indexes, `assignedAt`, and `audit_logs` is **pending** — run `npx prisma migrate dev` where the database is reachable.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env`. All values are read centrally in `src/app/config/index.ts` (except `DATABASE_URL`, read directly by `src/app/lib/prisma.ts`).

```bash
# App
NODE_ENV=development
PORT=5000
BACKEND_URL=http://localhost:5000   # must be publicly reachable for SSLCommerz callbacks
FRONTEND_URL=http://localhost:3000  # CORS origin + callback redirect target

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/powergriddb?schema=public"

# JWT
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=1d
JWT_REFRESH_EXPIRES_IN=7d

# Password hashing
BCRYPT_SALT_ROUNDS=10

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com

# Auto-seeded accounts (created on every boot if missing)
TESTER_ADMIN_NAME / TESTER_ADMIN_EMAIL / TESTER_ADMIN_PASSWORD
TESTER_POWER_OPERATOR_NAME / TESTER_POWER_OPERATOR_EMAIL / TESTER_POWER_OPERATOR_PASSWORD
TESTER_TECHNICIAN_NAME / TESTER_TECHNICIAN_EMAIL / TESTER_TECHNICIAN_PASSWORD

# Redis (OTP storage — required at runtime)
REDIS_USER / REDIS_PASSWORD / REDIS_HOST / REDIS_PORT

# SMTP (Gmail app password)
EMAIL_SENDER / SMTP_USER / SMTP_PASSWORD

# Cloudinary
CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET

# SSLCommerz
SSLC_STORE_ID / SSLC_STORE_PASSWORD
SSLC_IS_LIVE=false
```

> ⚠️ Never commit a real `.env`. Treat every value above as a placeholder.

---

## ⚙️ Getting Started

**Prerequisites:** Node.js 20+, PostgreSQL 14+, Redis (local or cloud).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then fill in real values

# 3. Generate the Prisma client (required — every file imports it)
npx prisma generate

# 4. Apply migrations
npx prisma migrate dev

# 5. Start in development (hot-reload)
npm run dev
```

On boot the server connects to PostgreSQL, connects Redis, verifies SMTP, auto-seeds the Admin / Power Operator / Technician accounts, and listens on `PORT`.

**Production build & run:**

```bash
npm run build   # bundle with tsup to dist/
npm start       # node dist/server.js
```

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (`tsx watch src/server.ts`, no typecheck) |
| `npm run build` | Bundle via `tsup` (ESM + CJS → `dist/`) |
| `npm start` | Run the built server |
| `npm run lint:check` / `lint:fix` | Biome lint on `./src` |
| `npm run format:check` / `format:fix` | Biome format |
| `npm test` | Stub — no test framework configured |

Sanity-check changes with `npx tsc --noEmit` (the **real** typecheck — `tsup` passes type-loose code that `tsc` rejects) + `npm run build`.

---

## 📁 Project Structure

```
├── prisma/
│   ├── schema/            # multi-file Prisma schema (one file per model + enums)
│   ├── migrations/        # committed SQL migrations
├── prisma7.config.ts      # Prisma 7 config (schema dir, migrations, DATABASE_URL)
├── src/
│   ├── server.ts          # bootstrap: DB → Redis → SMTP → seed → listen
│   ├── app.ts             # Express app: CORS, parsers, /api/v1 mounting, error handlers
│   ├── generated/prisma/  # Prisma client output (generated, committed)
│   └── app/
│       ├── config/        # central env access
│       ├── interfaces/    # shared IQuery + pagination types
│       ├── lib/           # prisma, redis, cloudinary, multer, nodemailer, googleAuth, sslcommerz
│       ├── middleware/    # checkAuth, validateRequest, globalErrorHandler, notFound, requestLogger
│       ├── module/        # auth, user, grid, outage, schedule, payment, analytics, application
│       │   └── <feature>/ # *.route / *.controller / *.service / *.interface / *.validation
│       ├── templates/     # EJS email templates
│       └── utils/         # AppError, catchAsync, jwt, sendResponse, seed, pagination, audit
├── .env.example
├── biome.json · tsconfig.json · tsup.config.ts · vercel.json
└── PowerGrid BD.postman_collection.json   # Postman collection (all modules incl. Analytics)
```

---

## 🛡️ Error Handling & Standards

- All errors flow through `AppError` (carries `statusCode`) → `catchAsync` (async wrapper, no try/catch in controllers) → `globalErrorHandler`, which maps Prisma errors (`P2002` duplicate, `P2003` FK, `P2025` not-found, `P1000`/`P1001` DB auth/unreachable) to friendly HTTP statuses and masks details in production.
- Every mutating route validates `req.body` with a Zod schema via `validateRequest` (schemas validate the body directly — no `{ body: ... }` wrapper).
- Success responses share one envelope: `{ success, statusCode, message, data, meta? }`.
- Multi-step business flows (booking confirmation, refunds) run inside `prisma.$transaction`; external API calls stay outside the transaction.
- Conventions: feature-per-folder modules, typed payloads in `*.interface.ts`, enums from `generated/prisma`, env only via central `config`, Conventional Commits (`feat:`, `fix:`, `docs:`, …).

## 📝 License

Distributed under the ISC License. See `package.json` (`"license": "ISC"`) for details.
