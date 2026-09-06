# Submission checklist — TrizenAI Full-Stack Internship

Email everything below to **talent@trizen-ai.com** before **Sep 20, 2026, 11:59 PM IST**.

| Deliverable | Status | Link / value |
|---|---|---|
| **Source code repository** | ✅ | https://github.com/pushtisonawala/framelink |
| **Live application URL** | ✅ | https://framelink-hazel.vercel.app |
| **README** (overview, stack, architecture, DB, setup, env, deploy, limitations) | ✅ | [`README.md`](README.md) |
| **Architecture / DB explanation** | ✅ | [`docs/architecture.md`](docs/architecture.md) (mermaid diagrams) |
| **Demo Admin credentials** | ✅ seed | `admin@framelink.demo` / `AdminDemo123!` |
| **Demo Team Member credentials** | ✅ seed | `sam@framelink.demo` / `MemberDemo123!` · `kavya@framelink.demo` / `MemberDemo123!` |
| **Demo Gallery URL + PIN** | ✅ | https://framelink-hazel.vercel.app/gallery/psd5tyhqqsvz · PIN `482917` |
| **Tests** | ✅ | `npm test` — 34 passing (auth, authz, validation, gallery guards, rate-limit) + skippable DB integration test |
| **Deployment** | ✅ | Vercel (app) + Supabase (Postgres + Storage) |

## Before you submit

1. `npm install && cp .env.example .env` — fill in Supabase + `JWT_SECRET`.
2. `npx prisma migrate deploy && npm run db:seed`
3. `npm run dev` — click through: register → create event → add member → (log in as member) upload → (admin) select → publish → open gallery link in incognito → enter PIN.
4. Push to GitHub (private is fine; add the evaluator if asked). **Confirm `.env` is not committed** — `git status` should never show it.
5. Deploy to Vercel, set env vars, run `prisma migrate deploy` + `db:seed` against the prod DB.
6. Fill the blank links above and in `README.md`'s header.

## Talking points for the evaluation

- **Stack rationale** — see README "Why these choices". Short version: one Next.js codebase = one deploy; Prisma+Postgres for real relational integrity; Supabase gives DB + S3-compatible storage together; custom JWT because the roles are simple and the customer flow is account-less.
- **Security** — README "Security model" maps each of the spec's five scenarios to code. Key ideas: non-members get 404 not 403; every image is a short-lived signed URL minted after an auth check; private bucket; PIN is bcrypt-hashed + rate-limited.
- **Scale** — cursor pagination everywhere, composite indexes for the admin filters, selection snapshotted into `GalleryPhoto` so re-curation never disturbs a live gallery.
- **What I'd do next** — direct-to-storage uploads via signed upload URLs, background thumbnail queue, Redis-backed rate limiting, ZIP download. The schema already anticipates the first two (`Photo.status`).
