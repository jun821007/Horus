-- Phase 2: 物流查詢貨態文字
alter table public.shipping_tracks
  add column if not exists status_text text;

create index if not exists idx_shipping_tracks_status_text
  on public.shipping_tracks (status_text)
  where status = '運輸中';
