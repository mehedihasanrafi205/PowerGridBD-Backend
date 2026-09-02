# PowerGridBD — Backend

REST API for a load-shedding / power-outage management system. Built with **Express 5**, **TypeScript**, **Prisma ORM 7**, and **PostgreSQL** — following the layered `route / controller / service / interface / validation` module pattern.

> **Note:** This repository contains the **backend only** and pairs with a separate frontend client (see `FRONTEND_URL`).

---

## Tech Stack

| Category      | Tools                                                                                  |
| ------------- | -------------------------------------------------------------------------------------- |
| Runtime       | Node.js 20+, Express 5, TypeScript 7                                                    |
| ORM           | Prisma 7 (`@prisma/adapter-pg` driver adapter), PostgreSQL                              |
| Validation    | Zod (`validateRequest` middleware)                                                      |
| Auth          | JWT (access + refresh, httpOnly cookies), bcrypt, Google OAuth (`google-auth-library`)  |
| Cache         | Redis (optional OTP storage, falls back to in-memory)                                   |
| Email         | Nodemailer + EJS templates                                                              |
| Uploads       | Multer (memory) + Cloudinary                                                            |
| Lint/Format   | Biome                                                                                   |

## Project Structure

```
src/
├── server.ts                       # connect DB, auto-seed, then listen
├── app.ts                          # express app: CORS, parsers, route mounting, error handlers
├── generated/prisma/               # generated Prisma client (committed; re-run `npx prisma generate`)
└── app/
    ├── config/index.ts             # reads/exposes every environment variable (never use process.env in app code)
    ├── interfaces/index.ts         # IQueryOptions / IQueryResult pagination types
    ├── builder/queryBuilder.ts     # parseQueryOptions / paginationArgs / withMeta helpers
    ├── lib/
    │   ├── prisma.ts               # shared PrismaClient (Pg adapter) — always import this
    │   ├── redis.ts                # Redis client (optional)
    │   ├── nodemailer.ts           # SMTP transport
    │   ├── cloudinary.ts           # Cloudinary config
    │   ├── multer.ts               # memory-storage uploader
    │   └── googleAuth.ts           # OAuth2Client
    ├── middleware/
    │   ├── checkAuth.ts            # auth(...roles) JWT + role guard
    │   ├── validateRequest.ts      # Zod schema middleware
    │   ├── globalErrorHandler.ts   # centralized error -> JSON
    │   └── notFound.ts             # 404 handler
    ├── utils/
    │   ├── AppError.ts             # error class with statusCode
    │   ├── catchAsync.ts           # async handler wrapper
    │   ├── jwt.ts                  # token sign/verify
    │   ├── sendResponse.ts         # standard `{ success, statusCode, message, data, meta? }` envelope
    │   ├── otp.ts                  # OTP generate/store/verify (Redis or in-memory)
    │   ├── sendEmail.ts            # render EJS template + send
    │   └── seed.ts                 # seedTesterAdmin()
    ├── templates/                  # EJS email templates
    └── module/                     # one folder per feature
        ├── auth/                   # registration (OTP verify), login, google, me, refresh, password reset
        └── user/                   # profile image upload, admin list/get with pagination
```

## Environment Variables

Copy `.env.example` to `.env` and fill in real values. All env variables are read centrally in `src/app/config/index.ts`.

| Variable                | Purpose                                    |
| ----------------------- | ------------------------------------------ |
| `NODE_ENV`              | `development` exposes full error detail    |
| `PORT`                  | Server port                                |
| `APP_URL`               | API base URL                               |
| `FRONTEND_URL`          | Allowed CORS origin                        |
| `DATABASE_URL`          | PostgreSQL connection string               |
| `JWT_*`                 | Access/refresh secrets & expiry            |
| `BCRYPT_SALT_ROUNDS`    | Password hashing rounds                    |
| `GOOGLE_CLIENT_ID`      | Google OAuth (optional)                    |
| `TESTER_ADMIN_*`        | Auto-seeded admin account                  |
| `REDIS_*`               | OTP cache (optional; falls back in-memory) |
| `SMTP_*`, `EMAIL_SENDER`| Email transport                            |
| `CLOUDINARY_*`          | Image uploads                              |

## Getting Started

```bash
npm install
cp .env.example .env   # set DATABASE_URL, JWT_*, SMTP_*, ...
npx prisma generate    # writes typed client to src/generated/prisma
npx prisma migrate dev # apply committed migrations
npm run dev            # tsx watch src/server.ts
```

On boot the server connects to the database, auto-seeds the tester admin, then listens on `PORT`.

## Scripts

| Command         | Description                          |
| --------------- | ------------------------------------ |
| `npm run dev`   | Hot-reload dev server                |
| `npm run build` | Bundle via `tsup` (ESM + CJS)        |
| `npm start`     | Run compiled `dist/`                 |
| `npm run lint:check` / `lint:fix`  | Biome lint         |
| `npm run format:check` / `format:fix` | Biome format    |

## Conventions

- **Modules:** feature-per-folder (`auth.route.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.interface.ts`, `auth.validation.ts`). Controllers never touch Prisma directly; services never touch `req`/`res`.
- **Types:** payloads typed in `*.interface.ts`; Prisma enums imported from `generated/prisma/enums`, never magic strings.
- **Validation:** mutating endpoints use `validateRequest(zodSchema)`.
- **Atomicity:** multi-step DB flows run inside `prisma.$transaction`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `refactor:`, ...).
