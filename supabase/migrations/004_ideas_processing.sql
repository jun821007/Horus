-- 想法背景分析中狀態
alter table public.ideas drop constraint if exists ideas_status_check;
alter table public.ideas add constraint ideas_status_check
  check (status in ('draft', 'processing', 'pending', 'adopted', 'archived'));
