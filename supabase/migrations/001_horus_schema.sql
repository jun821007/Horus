-- Horus unified schema (Supabase / PostgreSQL)
-- Run via Supabase SQL editor or: supabase db push

-- Extensions
create extension if not exists "pgcrypto";

-- ─── Shipping tracks (台灣單號) ───
create table if not exists public.shipping_tracks (
  tracking_number text primary key,
  carrier text not null check (carrier in ('新竹物流', '黑貓', '超商')),
  content_summary text not null default '',
  status text not null default '運輸中' check (status in ('運輸中', '已到貨')),
  last_check_date timestamptz,
  raw_input text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shipping_tracks_status on public.shipping_tracks (status);
create index if not exists idx_shipping_tracks_last_check on public.shipping_tracks (last_check_date);

-- ─── Inventory (實際庫存) ───
create table if not exists public.inventories (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity integer not null default 0 check (quantity >= 0),
  unit_cost_twd numeric(12, 4) not null default 0,
  category text default '',
  updated_at timestamptz not null default now(),
  unique (item_name)
);

create index if not exists idx_inventories_item_name on public.inventories (item_name);

-- ─── Inventory drafts (兩階段入庫：待確認) ───
create table if not exists public.inventory_drafts (
  id uuid primary key default gen_random_uuid(),
  item_name text not null,
  quantity integer not null check (quantity > 0),
  rmb_amount numeric(12, 2),
  twd_amount numeric(12, 2) not null,
  exchange_rate numeric(12, 4),
  unit_cost_twd numeric(12, 4) not null,
  source_image_url text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_drafts_status on public.inventory_drafts (status);

-- ─── Financial expenses (採購成本支出) ───
create table if not exists public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  amount_twd numeric(12, 2) not null,
  category text not null default '採購成本支出',
  memo text,
  inventory_draft_id uuid references public.inventory_drafts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Reminders (提醒事項 + 出貨預警) ───
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  kind text not null default 'general' check (kind in ('general', 'arrival', 'ship_alert', 'system')),
  target_ship_date date,
  is_read boolean not null default false,
  is_pushed boolean not null default false,
  related_tracking text references public.shipping_tracks (tracking_number) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reminders_target_ship on public.reminders (target_ship_date);
create index if not exists idx_reminders_unread on public.reminders (is_read) where is_read = false;

-- ─── Lychee shipments (荔枝出貨單) ───
create table if not exists public.lychee_shipments (
  id uuid primary key default gen_random_uuid(),
  order_label text not null default '',
  target_ship_date date not null,
  items_summary text default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'shipped', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_lychee_shipments_date on public.lychee_shipments (target_ship_date);

-- ─── Daily profits (純毛利，POS 記帳) ───
create table if not exists public.daily_profits (
  id uuid primary key default gen_random_uuid(),
  profit_date date not null default (timezone('Asia/Taipei', now()))::date,
  net_profit numeric(12, 2) not null,
  sale_amount numeric(12, 2) not null default 0,
  cost_amount numeric(12, 2) not null default 0,
  item_name text,
  quantity integer not null default 1,
  order_ref text,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_profits_date on public.daily_profits (profit_date desc);

-- updated_at trigger for shipping_tracks
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_shipping_tracks_updated on public.shipping_tracks;
create trigger trg_shipping_tracks_updated
  before update on public.shipping_tracks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_lychee_shipments_updated on public.lychee_shipments;
create trigger trg_lychee_shipments_updated
  before update on public.lychee_shipments
  for each row execute function public.set_updated_at();

-- Realtime (enable in Supabase dashboard if needed)
alter publication supabase_realtime add table public.daily_profits;
alter publication supabase_realtime add table public.reminders;
alter publication supabase_realtime add table public.inventory_drafts;

-- RLS: service role bypasses; anon/authenticated read via policies (adjust per deployment)
alter table public.shipping_tracks enable row level security;
alter table public.inventories enable row level security;
alter table public.inventory_drafts enable row level security;
alter table public.financial_expenses enable row level security;
alter table public.reminders enable row level security;
alter table public.lychee_shipments enable row level security;
alter table public.daily_profits enable row level security;

-- Permissive policies for authenticated users (tighten in production)
do $$
declare
  t text;
begin
  foreach t in array array[
    'shipping_tracks', 'inventories', 'inventory_drafts',
    'financial_expenses', 'reminders', 'lychee_shipments', 'daily_profits'
  ]
  loop
    execute format('drop policy if exists horus_all_%s on public.%I', t, t);
    execute format(
      'create policy horus_all_%s on public.%I for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
