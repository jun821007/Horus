-- Horus 想法輸入器 P0（獨立於 001 物流/庫存表）
-- 若曾執行過舊版 002，請先 DROP 相關 idea_* 表再執行本檔

create extension if not exists "pgcrypto";

-- 若未跑過 001，仍需要 updated_at trigger 函式
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── 分類樹 ───
create table if not exists public.idea_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.idea_categories (id) on delete set null,
  name text not null check (char_length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_idea_categories_parent on public.idea_categories (parent_id);
create index if not exists idx_idea_categories_sort on public.idea_categories (sort_order);

-- ─── 想法主檔 ───
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'pending', 'adopted', 'archived')),
  category_id uuid references public.idea_categories (id) on delete set null,
  priority text check (priority is null or priority in ('P0', 'P1', 'P2')),
  priority_manual integer,
  adopted_plan_index smallint check (adopted_plan_index is null or adopted_plan_index in (1, 2)),
  map_node_id uuid,
  goal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ideas_status on public.ideas (status);
create index if not exists idx_ideas_category on public.ideas (category_id);

-- ─── 對話訊息 ───
create table if not exists public.idea_messages (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_idea_messages_idea on public.idea_messages (idea_id, created_at);

-- ─── AI 方案（每輪最多兩筆）───
create table if not exists public.idea_plans (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas (id) on delete cascade,
  plan_index smallint not null check (plan_index in (1, 2)),
  title text not null default '',
  problem_points jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  next_step text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_idea_plans_idea on public.idea_plans (idea_id, created_at desc);

drop trigger if exists trg_idea_categories_updated on public.idea_categories;
create trigger trg_idea_categories_updated
  before update on public.idea_categories
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ideas_updated on public.ideas;
create trigger trg_ideas_updated
  before update on public.ideas
  for each row execute function public.set_updated_at();

-- 預設 seed（規格 §4.5）
insert into public.idea_categories (name, sort_order)
select v.name, v.sort_order
from (values
  ('產品', 10),
  ('技術', 20),
  ('生活', 30),
  ('學習', 40),
  ('資源', 50),
  ('人際', 60),
  ('健康', 70),
  ('財務', 80),
  ('其他', 90)
) as v(name, sort_order)
where not exists (
  select 1 from public.idea_categories c where c.name = v.name and c.parent_id is null
);

-- RLS
alter table public.idea_categories enable row level security;
alter table public.ideas enable row level security;
alter table public.idea_messages enable row level security;
alter table public.idea_plans enable row level security;

do $$
declare t text;
begin
  foreach t in array array['idea_categories', 'ideas', 'idea_messages', 'idea_plans']
  loop
    execute format('drop policy if exists horus_all_%s on public.%I', t, t);
    execute format(
      'create policy horus_all_%s on public.%I for all using (true) with check (true)',
      t, t
    );
  end loop;
end $$;
