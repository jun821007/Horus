import { config } from '../config.js'
import { fetchIntegrationJson } from '../lib/integration-fetch.js'
import { taipeiDayStartIso, taipeiTomorrowYmd, taipeiYmd } from '../lib/taipei-date.js'
import { taipeiMonthRange } from '../lib/taipei-month.js'
import { getSupabase } from '../lib/supabase.js'
import { fetchLifeCountdowns } from './life-countdown.js'

export type ReminderKind = 'general' | 'arrival' | 'ship_alert' | 'system' | 'hot_seller'

type ZhTomorrowResponse = {
  ship_date: string
  count: number
  orders: Array<{ customer_name: string }>
}

type HotSellersResponse = {
  period_days: number
  items: Array<{ category: string; item_name: string; outbound_qty: number; rank: number }>
}

async function hasReminderToday(kind: ReminderKind, extra?: { target_ship_date?: string }): Promise<boolean> {
  const sb = getSupabase()
  const today = taipeiYmd()
  let q = sb
    .from('reminders')
    .select('id')
    .eq('kind', kind)
    .gte('created_at', taipeiDayStartIso(today))
    .limit(1)
  if (extra?.target_ship_date) q = q.eq('target_ship_date', extra.target_ship_date)
  const { data } = await q
  return (data?.length ?? 0) > 0
}

async function insertReminder(input: {
  title: string
  body: string
  kind: ReminderKind
  target_ship_date?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('reminders').insert({
    title: input.title,
    body: input.body,
    kind: input.kind,
    is_read: false,
    is_pushed: true,
    target_ship_date: input.target_ship_date ?? null,
    metadata: input.metadata ?? null,
  })
  if (error) throw error
}

function formatCustomerList(names: string[], max = 5): string {
  if (names.length === 0) return ''
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  const line = shown.join('、')
  return rest > 0 ? `${line} 等 ${names.length} 筆` : line
}

function formatHotTop3(items: HotSellersResponse['items']): string {
  const top = items.slice(0, 3)
  if (top.length === 0) return '本週尚無出庫紀錄'
  return top
    .map((i) => `${i.category.replace(/^[^\w\u4e00-\u9fff]+/, '').trim()} ${i.item_name}(${i.outbound_qty})`)
    .join('、')
}

export async function fetchZhTomorrowShipments(): Promise<ZhTomorrowResponse | null> {
  if (!config.zhApiBaseUrl || !config.zhHorusReadSecret) return null
  return fetchIntegrationJson<ZhTomorrowResponse>(
    config.zhApiBaseUrl,
    '/api/horus/tomorrow-shipments',
    config.zhHorusReadSecret,
  )
}

export async function fetchInStockHotSellers(days = 7, limit = 10): Promise<HotSellersResponse | null> {
  if (!config.instockApiBaseUrl || !config.instockHorusReadSecret) return null
  return fetchIntegrationJson<HotSellersResponse>(
    config.instockApiBaseUrl,
    '/api/horus/hot-sellers',
    config.instockHorusReadSecret,
    { days, limit },
  )
}

export async function runLycheeTomorrowReminderCron(): Promise<{
  source: 'zh' | 'local' | 'skipped'
  tomorrow: string
  count: number
  alerted: number
}> {
  const tomorrow = taipeiTomorrowYmd()

  if (config.zhApiBaseUrl && config.zhHorusReadSecret) {
    const data = await fetchZhTomorrowShipments()
    const count = data?.count ?? 0
    if (count === 0) return { source: 'zh', tomorrow, count: 0, alerted: 0 }

    if (await hasReminderToday('ship_alert', { target_ship_date: tomorrow })) {
      return { source: 'zh', tomorrow, count, alerted: 0 }
    }

    const names = (data?.orders ?? []).map((o) => o.customer_name).filter(Boolean)
    await insertReminder({
      title: `【荔枝】明天有 ${count} 筆出貨`,
      body: formatCustomerList(names),
      kind: 'ship_alert',
      target_ship_date: tomorrow,
      metadata: { source: 'zh', deep_link: config.zhAppUrl || config.zhApiBaseUrl },
    })
    return { source: 'zh', tomorrow, count, alerted: 1 }
  }

  const sb = getSupabase()
  const { data: shipments, error } = await sb
    .from('lychee_shipments')
    .select('order_label')
    .eq('target_ship_date', tomorrow)
    .eq('status', 'scheduled')
  if (error) throw error
  const count = shipments?.length ?? 0
  if (count === 0) return { source: 'local', tomorrow, count: 0, alerted: 0 }

  if (await hasReminderToday('ship_alert', { target_ship_date: tomorrow })) {
    return { source: 'local', tomorrow, count, alerted: 0 }
  }

  const names = (shipments ?? []).map((s) => s.order_label as string)
  await insertReminder({
    title: `【荔枝】明天有 ${count} 筆出貨`,
    body: formatCustomerList(names),
    kind: 'ship_alert',
    target_ship_date: tomorrow,
    metadata: { source: 'local' },
  })
  return { source: 'local', tomorrow, count, alerted: 1 }
}

export async function runHotSellerReminderCron(): Promise<{ alerted: number; top_count: number }> {
  const month = taipeiMonthRange()
  const data = await fetchInStockHotSellers(month.dayOfMonth, 10)
  if (!data || data.items.length === 0) return { alerted: 0, top_count: 0 }

  if (await hasReminderToday('hot_seller')) {
    return { alerted: 0, top_count: data.items.length }
  }

  await insertReminder({
    title: '【熱銷】本月出庫 Top3',
    body: formatHotTop3(data.items),
    kind: 'hot_seller',
    metadata: {
      source: 'instock',
      deep_link: config.instockAppUrl || config.instockApiBaseUrl,
      period_days: month.dayOfMonth,
      period_start: month.start,
      period_end: month.end,
    },
  })
  return { alerted: 1, top_count: data.items.length }
}

export async function getDashboardSummary() {
  const sb = getSupabase()
  const month = taipeiMonthRange()

  const profitPromise = import('./profit.js')
    .then((m) => m.getMonthProfitSummary())
    .catch(() => null)

  const hotPromise = fetchInStockHotSellers(month.dayOfMonth, 10).catch(() => null)
  const lifeCountdownPromise = fetchLifeCountdowns().catch(() => null)

  const [remindersRes, tracksRes, ideasRes, profit, hotData, lifeCountdown] = await Promise.all([
    sb
      .from('reminders')
      .select('id, title, body, kind, is_read, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(30),
    sb.from('shipping_tracks').select('status').eq('status', '運輸中'),
    sb.from('ideas').select('id').in('status', ['pending', 'processing']),
    profitPromise,
    hotPromise,
    lifeCountdownPromise,
  ])

  const reminders = remindersRes.data ?? []
  const upcoming = reminders.filter((r) => !r.is_read).slice(0, 8)

  const next_countdown = lifeCountdown?.next
    ? {
        ...lifeCountdown.next,
        deep_link: lifeCountdown.next.deep_link || config.lifeAppUrl || null,
      }
    : null

  const countdowns = (lifeCountdown?.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    due_date: item.due_date,
    days_until: item.days_until,
    days_label: item.days_label,
    subtitle: item.subtitle,
  }))

  return {
    upcoming_reminders: upcoming,
    next_countdown,
    countdowns,
    hot_sellers: {
      period_label: `${month.start.slice(0, 7)} 本月`,
      period_start: month.start,
      period_end: month.end,
      items: hotData?.items ?? [],
      deep_link: config.instockAppUrl || config.instockApiBaseUrl || null,
    },
    unread_total: reminders.filter((r) => !r.is_read).length,
    shipping_in_transit: tracksRes.data?.length ?? 0,
    pending_ideas: ideasRes.data?.length ?? 0,
    profit_month_total: profit?.month_total ?? 0,
    profit_daily_average: profit?.daily_average ?? 0,
    profit_pos: profit?.pos_profit ?? 0,
    profit_custom: profit?.custom_profit ?? 0,
    profit_period_start: profit?.period_start ?? null,
    profit_period_end: profit?.period_end ?? null,
  }
}

