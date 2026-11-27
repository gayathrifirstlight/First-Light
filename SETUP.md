# Setting up First Light (about 15 minutes)

You need three things: Node.js, a free Supabase project, and (optionally) a Claude API key.

## 1. Install Node.js

Download the LTS version from https://nodejs.org and install it. Then, in a terminal, in this project folder:

```bash
npm install
```

## 2. Create the Supabase project (accounts + database)

1. Go to https://supabase.com, sign up, and click **New project**. Pick a region close to your sellers
   (e.g. Mumbai). Save the database password somewhere safe.
2. When it's ready, open **SQL Editor → New query**, paste everything from
   `supabase/migrations/20261127000000_orders_import.sql`, and click **Run**. This creates the
   `imports` and `orders` tables and the rules that keep each seller's data private.
3. Open **Project Settings → API** (or the **Connect** button). Copy the **Project URL** and the
   **publishable** (or "anon") key.
4. Optional, for testing: **Authentication → Sign In / Providers → Email** and switch off
   "Confirm email", so new test accounts can log in straight away. Leave it on for real testers.
5. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for now
   (later, your real web address).

## 3. Get a Claude API key (optional but recommended)

Go to https://console.anthropic.com → **API Keys** → **Create key**. Without it, the import still
works but column suggestions come from simple keyword rules instead of AI.

## 4. Add the keys

Copy `.env.example` to a new file called `.env.local` and paste in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` is private and never committed to GitHub.

## 5. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign up, then go to **Import** and upload
`test/fixtures/sample-orders-fake.xlsx` (fake data) to try it.

## Putting it online for testers (later)

Vercel (https://vercel.com) is the easiest: import the GitHub repo, add the same three keys under
**Settings → Environment Variables**, and deploy. Then add the Vercel address to Supabase's
**URL Configuration**.
