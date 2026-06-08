-- 單號到貨時間
alter table public.shipping_tracks
  add column if not exists arrived_at timestamptz;

create index if not exists idx_shipping_tracks_arrived_at
  on public.shipping_tracks (arrived_at)
  where status = '已到貨';

create table if not exists public.profit_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.profit_adjustments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.profit_categories (id) on delete set null,
  item_name text not null,
  net_profit numeric(12, 2) not null,
  profit_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_profit_adjustments_date on public.profit_adjustments (profit_date desc);

insert into public.profit_categories (name, sort_order)
values ('其他', 0)
on conflict (name) do nothing;

alter table public.profit_categories enable row level security;
alter table public.profit_adjustments enable row level security;

drop policy if exists profit_categories_all on public.profit_categories;
create policy profit_categories_all on public.profit_categories for all using (true) with check (true);

drop policy if exists profit_adjustments_all on public.profit_adjustments;
create policy profit_adjustments_all on public.profit_adjustments for all using (true) with check (true);
