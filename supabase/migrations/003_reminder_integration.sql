alter table public.reminders drop constraint if exists reminders_kind_check;
alter table public.reminders add constraint reminders_kind_check
  check (kind in ('general', 'arrival', 'ship_alert', 'system', 'hot_seller'));
alter table public.reminders add column if not exists metadata jsonb;
create index if not exists idx_reminders_kind_created on public.reminders (kind, created_at desc);
