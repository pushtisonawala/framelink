# Runbook — get FrameLink running & deployed

Follow top to bottom. Every command is run from the project folder `C:\dev\trizen`
in **PowerShell** (or Git Bash — both work).

---

## Phase 0 — one-time prerequisites

You need three free accounts:

1. **Supabase** — <https://supabase.com> (database + photo storage)
2. **GitHub** — <https://github.com> (source repository)
3. **Vercel** — <https://vercel.com> (hosting) — sign in *with GitHub*

Local tools (already installed on this machine — check with the commands):

```powershell
node -v      # must print v18.18+ (you have v24)
git --version
```

---

## Phase 1 — create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name: `framelink`. Set a **database password** — **write it down**, you need it in step 3.
   Pick the region closest to you. Wait ~2 minutes for it to provision.

### 1a. Get the database connection strings

1. In the project, click **Connect** (top bar) → tab **ORMs** → framework **Prisma**.
   (Or: **Project Settings → Database → Connection string**.)
2. You'll see two URIs. Copy both, and replace `[YOUR-PASSWORD]` with the password from step 1:
   - **Transaction pooler** (port **6543**) → this is your `DATABASE_URL`
   - **Session pooler / Direct** (port **5432**) → this is your `DIRECT_URL`

They look like:

```
DATABASE_URL = postgresql://postgres.abcdxyz:YOURPASS@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL   = postgresql://postgres.abcdxyz:YOURPASS@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

> If your password has special characters like `@ # / :`, URL-encode them
> (`@` → `%40`, `#` → `%23`). Easiest: use a password with only letters + numbers.

### 1b. Get the API keys (for photo storage)

1. **Project Settings → API**.
2. Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
3. Under *Project API keys*, copy the **`service_role`** secret (click "Reveal") → `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ This is a powerful secret. Never commit it, never put it in frontend code. Our app only uses it server-side.

> The private storage bucket (`event-photos`) is created **automatically** by the seed
> script in Phase 3. You don't need to make it by hand.

---

## Phase 2 — configure the app locally

### 2a. Create the `.env` file

```powershell
Copy-Item .env.example .env
```

### 2b. Generate a JWT secret

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Copy the output.

### 2c. Fill in `.env`

Open `.env` in your editor and set these **6 values** (leave the rest as-is):

```ini
DATABASE_URL="postgresql://postgres.abcdxyz:YOURPASS@aws-0-....pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.abcdxyz:YOURPASS@aws-0-....pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://abcdxyz.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi....(long string)"
JWT_SECRET="the-48-byte-string-you-just-generated"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Save the file.

---

## Phase 3 — set up the database & demo data

Run these **one at a time**, in order:

```powershell
npm install
```

```powershell
npx prisma generate
```

```powershell
npx prisma migrate deploy
```

This creates all the tables in your Supabase database. You can confirm in
Supabase → **Table Editor** (you'll see `User`, `Event`, `Photo`, `Gallery`, …).

```powershell
npm run db:seed
```

This creates demo users, an event, ~24 generated photos (uploaded to Supabase
Storage), and one published gallery. **When it finishes it prints a box** with:

```
Admin login  : admin@framelink.demo / AdminDemo123!
Team member  : sam@framelink.demo / MemberDemo123!
Team member  : kavya@framelink.demo / MemberDemo123!
Gallery URL  : http://localhost:3000/gallery/<slug>
Gallery PIN  : 482917
```

**Copy that box somewhere** — you need it for your submission.

---

## Phase 4 — run it locally

```powershell
npm run dev
```

Open <http://localhost:3000>. Now walk the full workflow to confirm everything works:

1. **Landing → "Create team account"** → register (you become an **Admin**).
2. **Events → New event** → create "Test Wedding".
3. Open the event → **Team members** tab → **Add member** → enter any email
   (e.g. `test@member.com`). A **one-time password box** pops up — note it.
4. **Log out**, log back in as that member with the one-time password →
   you're asked to set a new password.
5. As the member, open the event → **Photos** → drag in a few images → they upload
   with thumbnails.
6. **Log out**, log in as your Admin → open the event → **Photos** → you now see
   the member's photos → click the ✓ on a few to select them.
7. **Galleries** tab → **Publish gallery** → give it a title → **Publish**.
   You get a **link + PIN** (shown once).
8. Open that link in a **private/incognito window** → enter the PIN → the gallery loads.
   Try a wrong PIN first — it's rejected.

Also try the pre-made demo: open the **Gallery URL** from the seed box in incognito,
PIN `482917`.

If all of that works, you're done locally. Stop the dev server with **Ctrl+C**.

---

## Phase 5 — push to GitHub

```powershell
git status
```

Confirm it does **not** list `.env` (it must stay private). Then:

Create an empty repo on GitHub named `framelink` (no README, no .gitignore —
the repo already has them). Copy its URL, then:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/framelink.git
```

```powershell
git push -u origin main
```

---

## Phase 6 — deploy to Vercel

1. <https://vercel.com/new> → **Import** your `framelink` GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Don't change build settings.
3. Expand **Environment Variables** and add these (copy the values from your `.env`):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your pooled 6543 string |
   | `DIRECT_URL` | your direct 5432 string |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdxyz.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` secret |
   | `JWT_SECRET` | same secret as local |
   | `NEXT_PUBLIC_APP_URL` | `https://framelink-xxxx.vercel.app` (your Vercel URL — you can set this after the first deploy and redeploy) |

4. Click **Deploy**. Wait ~2 minutes.
5. After it's live, copy the real domain, set `NEXT_PUBLIC_APP_URL` to it in
   Vercel → Settings → Environment Variables, and **Redeploy** (Deployments → ⋯ → Redeploy).
   This makes the shareable gallery links point at the right domain.

### 6a. Seed the production database (optional but recommended for the demo)

The tables are already there (same Supabase DB you migrated in Phase 3). To also
put demo data in production, from your machine with `.env` still pointing at Supabase:

```powershell
npm run db:seed
```

(Already done in Phase 3 → you can skip this. Only re-run if you reset the DB.)

### 6b. Verify

- Open `https://YOUR-APP.vercel.app/api/health` → should show `{"status":"ok","db":"up"}`.
- Open `https://YOUR-APP.vercel.app` → register / log in / everything from Phase 4.

---

## Phase 7 — finalise the submission

1. Edit **`README.md`** — fill the 3 blanks at the top (live URL, demo gallery URL, they're near line 10).
2. Edit **`SUBMISSION.md`** — fill the blank links in the table.
3. Commit & push:

   ```powershell
   git add README.md SUBMISSION.md
   ```

   ```powershell
   git commit -m "Add live URLs to docs"
   ```

   ```powershell
   git push
   ```

4. Email **talent@trizen-ai.com** with:
   - GitHub repo link
   - Live app URL
   - Admin credentials: `admin@framelink.demo` / `AdminDemo123!`
   - Team member credentials: `sam@framelink.demo` / `MemberDemo123!`
   - Demo gallery URL + PIN `482917`

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `prisma migrate deploy` hangs or "prepared statement" error | You swapped the URLs. `DIRECT_URL` must be the **5432** one. |
| `Invalid or missing environment variables` on `npm run dev` | A value in `.env` is empty or `JWT_SECRET` is under 32 chars. |
| Seed: `The resource was not found` on storage | `SUPABASE_SERVICE_ROLE_KEY` is wrong (you may have copied the `anon` key). Use `service_role`. |
| Photos upload but show broken thumbnails | Wrong `NEXT_PUBLIC_SUPABASE_URL`, or the bucket got created public — it should be private; signed URLs handle access. |
| Vercel build fails on Prisma | Make sure `DATABASE_URL` **and** `DIRECT_URL` are both set in Vercel env vars. |
| Supabase DB "paused" after a few days idle | Free tier pauses. Open the Supabase dashboard to resume it before your evaluation. |
| Gallery links show `localhost:3000` | Set `NEXT_PUBLIC_APP_URL` to your Vercel domain and redeploy. |
