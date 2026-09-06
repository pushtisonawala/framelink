# FrameLink

A collaborative event photo-sharing platform. A photography team uploads every shot from an
event, a lead curates the keepers, and the client views a **PIN-protected gallery** from a
shareable link — no account required.

Built for the TrizenAI Full-Stack Internship take-home.

> **Live app:** _<add your Vercel URL>_
> **Demo gallery:** _<add gallery URL>_ · **PIN:** `482917`
> **Demo credentials:** see [Demo accounts](#demo-accounts)

---

## Table of contents

- [Features](#features)
- [Technology stack](#technology-stack) · [why these choices](#why-these-choices)
- [System architecture](#system-architecture)
- [Data model](#data-model)
- [API reference](#api-reference)
- [Security model](#security-model)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Deployment](#deployment-vercel--supabase)
- [Testing](#testing)
- [Demo accounts](#demo-accounts)
- [Known limitations & trade-offs](#known-limitations--trade-offs)

---

## Features

### Core (per the requirement spec)

| Requirement | Where |
|---|---|
| Admin register / login, role-based authorization | `src/app/api/auth/*`, `src/lib/session.ts`, `src/middleware.ts` |
| Create event, add team members (auto one-time password) | `src/app/api/events/[eventId]/members/route.ts` |
| Team member: view assigned events, upload photos, view own photos | `src/components/events/photo-panel.tsx`, `src/app/api/events/[eventId]/photos/route.ts` |
| Multi-file uploads to object storage (not the DB) | Supabase Storage via `src/lib/supabase.ts`; DB stores metadata only |
| Admin: view **all** team photos, search / filter, select for gallery | `photo-panel.tsx`, `.../photos/select/route.ts` |
| Publish gallery → shareable link + PIN | `.../galleries/route.ts`, `src/lib/gallery.ts` |
| Customer: open link, enter PIN, browse published photos, no account | `src/app/gallery/[slug]/*` |
| Handles: cross-event access, member-publish attempt, failed upload, wrong PIN, unpublished-photo access | see [Security model](#security-model) + `tests/` |

### Bonus features implemented

- **Thumbnails / image resizing** — every upload gets a 600 px WebP thumbnail generated with `sharp`; galleries lazy-load thumbnails and only fetch full-res on demand.
- **Pagination / infinite scroll** — cursor-based pagination on every photo list (team view and client gallery) with an `IntersectionObserver`.
- **Photo search & filtering** — by filename, by uploader, by selection state, by upload status.
- **Bulk upload** — drag-and-drop, up to 50 files/request, chunked with per-file success/error reporting so one bad file never fails the batch.
- **Photo downloading** — single-photo download via short-lived signed URLs; toggle per gallery.
- **Gallery expiration** — optional `expiresAt`; expired links return 403 and show a friendly notice.
- **PIN rotation & unpublish** — regenerate a PIN or take a gallery offline without deleting it.
- **Rate limiting** — PIN attempts are rate-limited per gallery + hashed IP (sliding window) to resist brute force; doubles as an audit log.
- **CDN** — Supabase Storage serves objects through its global CDN; signed URLs are cache-friendly.
- **CI** — GitHub Actions runs typecheck, lint, and tests on every push/PR.
- **Docker** — multi-stage `Dockerfile` + `docker-compose.yml` (app + Postgres) for a one-command local stack.
- **Health check** — `/api/health` probes DB connectivity for uptime monitors.

---

## Technology stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14** (App Router) — one codebase for UI + API (route handlers) |
| Language | **TypeScript** (strict) |
| Database | **PostgreSQL** (Supabase) via **Prisma ORM** |
| Object storage | **Supabase Storage** (private bucket, signed URLs) |
| Auth | Custom — **bcrypt** password hashing + **JWT** (`jose`) in `httpOnly` cookies |
| Validation | **Zod** on every request body / query |
| Images | **sharp** (thumbnails, EXIF-aware rotation, dimensions) |
| UI | **Tailwind CSS**, **lucide-react** icons, custom components |
| Tests | **Vitest** |
| Hosting | **Vercel** (app) + **Supabase** (Postgres + Storage) |

### Why these choices

- **Next.js full-stack** — the frontend and API ship and deploy together; server components read the DB directly for fast first paint, route handlers cover the mutating API. One repo, one deploy target, minimal glue.
- **Prisma + Postgres** — relational data (users ↔ events ↔ photos ↔ galleries) with real foreign keys and constraints. Prisma gives a typed schema, migrations, and a readable query layer. `@@unique([eventId, userId])` and `@@unique([galleryId, photoId])` enforce integrity the app would otherwise have to police.
- **Supabase** — Postgres **and** S3-compatible object storage behind one dashboard and one set of credentials, with a generous free tier. The storage code uses the standard `createSignedUrl` API, so moving to raw S3 / R2 later is a small adapter change in `src/lib/supabase.ts`.
- **Custom JWT auth** rather than NextAuth — the role model is simple (ADMIN / TEAM_MEMBER) and the customer flow is *account-less*, so a full auth framework adds more than it removes. Stateless JWTs in `httpOnly` cookies keep the API easy to reason about and test.
- **Signed URLs, private bucket** — the bucket is never public. Every image the browser loads is a time-limited signed URL minted by the server *after* an authorization check, so photo access always flows through application logic.

---

## System architecture

```
                    ┌──────────────────────────────────────────────┐
                    │                  Browser                      │
                    │  Team dashboard  ·  Admin curation  ·  Client │
                    │            PIN gallery (no account)           │
                    └───────────────┬──────────────────────────────┘
                                    │  HTTPS (httpOnly session cookie /
                                    │         slug-scoped gallery cookie)
                    ┌───────────────▼──────────────────────────────┐
                    │            Next.js 14 on Vercel               │
                    │                                              │
                    │  ┌────────────────┐   ┌────────────────────┐  │
                    │  │ Server         │   │ Route handlers     │  │
                    │  │ Components     │   │ /api/*             │  │
                    │  │ (read models)  │   │ (mutations, auth)  │  │
                    │  └───────┬────────┘   └─────────┬──────────┘  │
                    │          │   lib/: auth · authz · gallery ·   │
                    │          │        rate-limit · images(sharp)  │
                    │  middleware.ts (edge redirect gate)           │
                    └──────────┼───────────────────────┼───────────┘
                               │ Prisma (pooled)       │ service-role key
                    ┌──────────▼──────────┐   ┌─────────▼───────────────┐
                    │  Supabase Postgres  │   │   Supabase Storage      │
                    │  users, events,     │   │   private bucket        │
                    │  event_members,     │   │   events/<id>/originals  │
                    │  photos (metadata), │   │   events/<id>/thumbnails │
                    │  galleries,         │   │   ─ served via signed    │
                    │  gallery_photos,    │   │     URLs + CDN           │
                    │  gallery_access_log │   └─────────────────────────┘
                    └─────────────────────┘
```

A visual version is in [`docs/architecture.md`](docs/architecture.md).

### Request flows

**Team member uploads photos**
1. `POST /api/events/:id/photos` (multipart). `assertEventAccess` confirms membership.
2. For each file: validate MIME + size → create `Photo(status=PENDING)` → upload original to Storage → `sharp` thumbnail → upload thumbnail → `Photo(status=READY)`.
3. A failed file is marked `FAILED`, its partial object removed, and reported in the per-file result array (HTTP 207 if some failed).

**Admin publishes a gallery**
1. Admin selects photos (`POST /api/events/:id/photos/select`, bulk).
2. `POST /api/events/:id/galleries` with `photoIds` + optional PIN. Server validates every photo belongs to the event and is `READY`, hashes the PIN (bcrypt), generates a URL-safe `slug`, snapshots the selection into `gallery_photos`.
3. Response returns the shareable URL and the PIN **once**.

**Customer views the gallery**
1. `GET /gallery/:slug` → server renders metadata; unpublished ⇒ 404 (existence not leaked), expired ⇒ notice.
2. `POST /api/gallery/:slug/verify` with the PIN → rate-limit check → bcrypt compare → on success, set an `httpOnly` cookie **scoped to `/gallery/:slug`** carrying a short-lived JWT.
3. `GET /api/gallery/:slug/photos` (cursor-paginated) → returns signed thumbnail + preview URLs. `GET /api/gallery/:slug/download/:photoId` → 302 to a signed download URL.

---

## Data model

Prisma schema: [`prisma/schema.prisma`](prisma/schema.prisma).

- **User** — `role: ADMIN | TEAM_MEMBER`, bcrypt `passwordHash`, `mustChangePassword` for admin-created members.
- **Event** — owned by an admin (`createdById`).
- **EventMember** — join table, `@@unique([eventId, userId])`. Presence here = permission to work on the event.
- **Photo** — metadata only: `storageKey`, `thumbnailKey`, `mimeType`, `fileSize`, `width/height`, `status: PENDING|READY|FAILED`, `selected`. Indexed on `[eventId, selected]` and `[eventId, status]`.
- **Gallery** — `slug` (unique, public id), `pinHash` (bcrypt), `published`, `publishedAt`, `expiresAt?`, `allowDownload`.
- **GalleryPhoto** — snapshot of the published selection with display `order`, `@@unique([galleryId, photoId])`.
- **GalleryAccessLog** — every PIN attempt: `success`, `ipHash` (SHA-256, never the raw IP), `userAgent`. Backs rate limiting + audit.

Photo binaries are **never** stored in the database — only in Supabase Storage.

---

## API reference

All responses are JSON. Errors: `{ "error": { "code", "message", "details?" } }`.

### Auth
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/register` | Creates an **ADMIN**. Sets session cookie. |
| `POST` | `/api/auth/login` | Sets session cookie. Uniform error on bad email/password. |
| `POST` | `/api/auth/logout` | Clears session. |
| `GET`  | `/api/auth/me` | Current user or `null`. |
| `POST` | `/api/auth/change-password` | Requires auth; clears `mustChangePassword`. |

### Events & members
| Method | Path | Role |
|---|---|---|
| `GET` | `/api/events` | any — admin sees all, member sees assigned |
| `POST` | `/api/events` | ADMIN |
| `GET` | `/api/events/:id` | member/admin of event |
| `PATCH` / `DELETE` | `/api/events/:id` | ADMIN (delete blocked if photos exist) |
| `GET` | `/api/events/:id/members` | member/admin |
| `POST` | `/api/events/:id/members` | ADMIN — returns one-time password for new users |
| `DELETE` | `/api/events/:id/members/:userId` | ADMIN |

### Photos
| Method | Path | Role |
|---|---|---|
| `GET` | `/api/events/:id/photos` | admin: all; member: own. `?cursor&limit&q&uploadedBy&selected&status` |
| `POST` | `/api/events/:id/photos` | member/admin — `multipart/form-data`, field `files` (≤50) |
| `POST` | `/api/events/:id/photos/select` | ADMIN — `{ photoIds[], selected }` |
| `GET` | `/api/photos/:id/url` | member (own) / admin — signed original URL, `?download=1` |
| `DELETE` | `/api/photos/:id` | uploader or admin |

### Galleries (admin)
| Method | Path |
|---|---|
| `GET` / `POST` | `/api/events/:id/galleries` |
| `GET` / `PATCH` / `DELETE` | `/api/galleries/:id` — PATCH supports `published`, `photoIds`, `expiresAt`, `allowDownload`, `rotatePin`, `pin` |

### Public gallery (no account)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/gallery/:slug` | metadata; 404 if unpublished |
| `POST` | `/api/gallery/:slug/verify` | `{ pin }` → sets slug-scoped access cookie; rate-limited (429 + `Retry-After`) |
| `GET` | `/api/gallery/:slug/photos` | requires access cookie; cursor-paginated signed URLs |
| `GET` | `/api/gallery/:slug/download/:photoId` | requires cookie + `allowDownload`; 302 to signed URL |

### Ops
| `GET` | `/api/health` | `{ status, db }`, 503 if DB down |

---

## Security model

The spec's five scenarios and how each is handled:

| Scenario | Handling |
|---|---|
| **A user tries to access another event** | `assertEventAccess` — non-members get **404** (not 403), so event existence isn't disclosed. Enforced in every event/photo/gallery route. |
| **A team member tries to publish a gallery** | `assertAdmin` on all gallery-write and selection routes → **403**. The UI hides the tab too, but the API is the source of truth. |
| **A failed photo upload** | Per-file `try/catch`; row marked `FAILED`, partial object deleted, batch returns HTTP **207** with a per-file error list. Other files in the batch still succeed. |
| **An incorrect gallery PIN** | bcrypt compare → **401**. Sliding-window rate limit per `(galleryId, ipHash)` → **429** with `Retry-After` after N failures. Every attempt logged. |
| **Access to unpublished / not-selected photos** | Public photo route only reads from `gallery_photos` of a **published, unexpired** gallery, and only with a valid slug-scoped cookie. Unpublished ⇒ 404. Original object keys are never exposed — only short-lived signed URLs. |

Additional measures: `httpOnly` + `secure` + `sameSite=lax` cookies; the gallery access cookie is named per-slug and carries a JWT bound to that slug (a token for one gallery can't unlock another); security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) in `next.config.mjs`; Zod validation on all input; `poweredByHeader: false`; secrets only in server env, never shipped to the client; `robots.ts` disallows indexing of galleries and the app.

---

## Local setup

**Prerequisites:** Node ≥ 18.18, a Supabase project (free tier) — or Docker for local Postgres.

```bash
git clone <your-repo-url> framelink && cd framelink
npm install
cp .env.example .env          # then fill in the values (see below)

npx prisma migrate deploy     # or: npx prisma db push   (first run)
npm run db:seed               # demo users, event, photos, published gallery

npm run dev                   # http://localhost:3000
```

The seed prints demo credentials and the demo gallery URL + PIN when it finishes.

### With Docker (app + Postgres, storage still Supabase)

```bash
cp .env.example .env          # set NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
docker compose up --build
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string. Supabase: use the **pooled** (port 6543) string with `?pgbouncer=true`. |
| `DIRECT_URL` | ✅ (migrations) | Supabase **direct** (port 5432) string — used by `prisma migrate`. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Server-only. Full storage access — **never** exposed to the browser. |
| `SUPABASE_STORAGE_BUCKET` | – | Default `event-photos`. Created by the seed script (private). |
| `JWT_SECRET` | ✅ | ≥ 32 random chars. `openssl rand -base64 48`. |
| `JWT_ISSUER` | – | Default `framelink`. |
| `SESSION_COOKIE_NAME`, `GALLERY_COOKIE_PREFIX` | – | Cookie names. |
| `NEXT_PUBLIC_APP_URL` | – | Public base URL — used to build shareable gallery links. |
| `MAX_UPLOAD_MB` | – | Per-file limit, default 25. |
| `SIGNED_URL_TTL_SECONDS` | – | Default 3600. |
| `GALLERY_SESSION_TTL_SECONDS` | – | Gallery cookie lifetime, default 7200. |
| `PIN_MAX_ATTEMPTS`, `PIN_ATTEMPT_WINDOW_SECONDS` | – | Rate limit, default 10 / 900 s. |

`src/lib/env.ts` validates all of these at boot and fails fast with a readable message.

---

## Deployment (Vercel + Supabase)

1. **Supabase** → New project. From _Project Settings → Database_ copy the pooled and direct connection strings. From _Project Settings → API_ copy the project URL and the `service_role` key.
2. **Storage** → the seed script creates the private `event-photos` bucket, or create it manually (Public = off).
3. **Vercel** → Import the GitHub repo. Add every variable from the table above (set `NEXT_PUBLIC_APP_URL` to the Vercel URL). Build command `npm run build`, which runs `prisma generate` first.
4. **Migrate** — from your machine, pointed at the Supabase DB:
   ```bash
   npx prisma migrate deploy
   npm run db:seed        # optional: demo data
   ```
5. Redeploy. Visit `/api/health` to confirm DB connectivity.

CI (`.github/workflows/ci.yml`) runs typecheck + lint + tests on every push; wire it as a required check before Vercel promotes to production if you like.

---

## Testing

```bash
npm test            # unit + guard tests (no DB needed)
npm run test:watch
```

Covered:

- **`tests/auth.test.ts`** — password/PIN hashing, session JWT round-trip + tamper rejection, **gallery token is slug-scoped** (a token for one gallery can't unlock another), PIN/temp-password generators, IP hashing.
- **`tests/authz.test.ts`** — `assertEventAccess` (admin vs member vs outsider → 404 not 403), `assertAdmin` (member → 403), `assertPhotoManage` (member can't touch another member's photo).
- **`tests/validation.test.ts`** — Zod schemas: email normalisation, password length, PIN format (4–8 digits), gallery requires ≥ 1 photo, upload MIME allow-list.
- **`tests/gallery.test.ts`** — expiry logic, unpublished ⇒ 404, expired ⇒ 403, PIN rate-limit window (allows below threshold, blocks above with a retry delay).
- **`tests/integration/workflow.test.ts`** — full flow against a real Postgres (**skipped unless `TEST_DATABASE_URL` is set**): admin creates event → adds member → member uploads → admin selects → publishes gallery → customer PIN wrong then right → unpublish hides it.

```bash
# run the integration test too:
createdb framelink_test
TEST_DATABASE_URL=postgresql://localhost:5432/framelink_test npx prisma db push
TEST_DATABASE_URL=postgresql://localhost:5432/framelink_test npm test
```

---

## Demo accounts

Created by `npm run db:seed`:

| Role | Email | Password |
|---|---|---|
| Admin / Lead | `admin@framelink.demo` | `AdminDemo123!` |
| Team member | `sam@framelink.demo` | `MemberDemo123!` |
| Team member | `kavya@framelink.demo` | `MemberDemo123!` |

**Demo gallery:** printed by the seed script · **PIN:** `482917`

---

## Known limitations & trade-offs

- **Uploads proxy through the API route.** Simple and keeps validation + thumbnailing server-side, but a very large batch is bound by the serverless function's body size / 60 s limit. Production would switch to Supabase **signed upload URLs** (direct browser → storage) with a confirm callback; the `Photo.status` state machine is already built for it.
- **Thumbnails are generated synchronously** on upload. At the spec's scale (1,250 photos) you'd move this to a queue / background worker. The schema (`status`, nullable `thumbnailKey`) already supports async generation.
- **Rate limiting is DB-backed** (sliding window over `gallery_access_log`). Fine for this scale and gives a free audit trail; a high-traffic deployment would front it with Redis / Upstash.
- **No "download all as ZIP"** — single-photo download only. Streaming a ZIP of signed originals is a clean follow-up.
- **`prisma migrate` needs the direct (non-pooled) connection**; the app uses the pooled one. Both are in `.env`.
- **Event deletion is blocked while photos exist** to avoid orphaned storage objects — a background janitor to sweep storage would remove that restriction.
- Session JWTs are not revocable before expiry (7 days). Acceptable for the roles here; a token version column on `User` would add revocation.
```
