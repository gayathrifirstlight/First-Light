-- First Light: tables for imported orders.
-- Run this once in your Supabase project (SQL Editor → paste → Run),
-- or with the Supabase CLI: `supabase db push`.

-- One row per spreadsheet upload, so we know where each order came from.
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null,
  sheet_name text,
  column_mapping jsonb not null,      -- what the seller confirmed: column -> field
  mapping_source text not null,       -- 'ai' or 'rules'
  imported_count int not null default 0,
  skipped_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  import_id uuid references public.imports (id) on delete set null,
  source text not null default 'spreadsheet',  -- later: 'shopify', 'instagram_dm'
  source_row int,
  order_date date,
  customer_name text,
  customer_contact text,
  channel text,
  product text,
  variant text,
  quantity int,
  unit_price numeric(12, 2),
  discount numeric(12, 2),
  total_amount numeric(12, 2),
  payment_status text not null default 'unknown'
    check (payment_status in ('paid', 'unpaid', 'partial', 'unknown')),
  payment_method text,
  delivery_status text,
  notes text,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  -- Flags the seller saw at import time (kept so we can show "imported with a warning").
  review_notes text[] not null default '{}',
  raw jsonb,                                   -- the original spreadsheet row
  created_at timestamptz not null default now()
);

create index if not exists orders_user_date_idx on public.orders (user_id, order_date desc);

-- Row level security: each seller can only ever see and change their own data.
alter table public.imports enable row level security;
alter table public.orders enable row level security;

create policy "Sellers manage their own imports" on public.imports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Sellers manage their own orders" on public.orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
