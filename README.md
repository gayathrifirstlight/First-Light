# First Light

All of a small seller's sales in one place (Instagram and WhatsApp DMs, Shopify, word of mouth), with AI
insights and advice. The AI suggests; the seller always makes the final call.

This is the **week 1 foundation**: accounts (sign up / log in) and importing orders from the Excel or
Google Sheet sellers already keep.

## What's in here

| Part | What it does |
|---|---|
| Sign up / log in | Email + password accounts through Supabase. Private pages need a login. |
| Spreadsheet import (`/import`) | Upload .xlsx or .csv → AI suggests what each column means → seller confirms → rows that are unclear are flagged for the seller instead of guessed → orders are saved. |
| Orders (`/orders`) and Overview (`/dashboard`) | The imported orders, totals, sales by channel and how many orders are waiting for payment. |

### How the import handles messy sheets

- Finds the header row even under a title, and skips month headings ("NOVEMBER"), repeated headers,
  blank rows and hand-typed TOTAL rows.
- Reads dates the Indian way (2/10 = 2 October), plus "2 oct", "05-10-2026" and Excel dates.
- Reads amounts like "1,348", "Rs 1198", "₹2,500/-".
- Reads "yes gpay", "upi", "cash" as paid plus the payment method.
- **Flags instead of guessing**: part payments ("50% adv"), balance rows with no date, cancelled orders,
  day-only dates ("8th"), incomplete phone numbers, approximate amounts ("~12k"), totals that don't
  add up. The seller can fix these and choose which to import.

The AI (Claude) is only used to suggest the column mapping. Without an API key the import still works
using keyword rules.

## Run it

See **[SETUP.md](SETUP.md)** for the step-by-step guide. Short version:

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase + Anthropic keys
npm run dev                  # open http://localhost:3000
```

## Tech choices (and why)

- **Next.js** (React) – the most common way to build a web app today; one codebase for pages and server code; deploys to Vercel in a click.
- **Supabase** – sign-up/login and a Postgres database in one free service; "row level security" makes sure each seller can only see their own orders.
- **Claude API** – suggests column mappings. Easy to extend later for the weekly brief and the chat.
- **Tailwind CSS** – styling.

## Code map

```
src/app/                 pages (login, signup, dashboard, import, orders)
src/app/api/import/      reads an uploaded file and suggests a mapping
src/lib/import/          the import logic (reading, finding the table, mapping, flagging)
src/lib/supabase/        login/session helpers
supabase/migrations/     database tables
test/fixtures/           the fake sample sheet used by the tests
```

## Checks

```bash
npm test          # import tests, using the fake sample sheet
npm run lint
npm run build
```
