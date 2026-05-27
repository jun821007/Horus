import { getSupabase } from '../lib/supabase.js'

export async function pushReminder(title: string, body: string, kind: 'general' | 'arrival' | 'ship_alert' | 'system', extra?: {
  target_ship_date?: string
  related_tracking?: string
}): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('reminders').insert({
    title,
    body,
    kind,
    is_read: false,
    is_pushed: true,
    target_ship_date: extra?.target_ship_date ?? null,
    related_tracking: extra?.related_tracking ?? null,
  })
  if (error) throw error
}

export async function notifyArrival(carrier: string, trackingNumber: string, contentSummary: string): Promise<void> {
  const body = `【到貨通知】${carrier}單號 ${trackingNumber} 已到貨。內容物：${contentSummary || '（未填）'}。`
  await pushReminder('到貨通知', body, 'arrival', { related_tracking: trackingNumber })
}

export async function notifyShipAlert(): Promise<number> {
  const sb = getSupabase()
  const body = '【出貨預警】明天有荔枝出貨單排程，請提前準備商品出貨。'
  const { error } = await sb.from('reminders').insert({
    title: '出貨預警',
    body,
    kind: 'ship_alert',
    is_read: false,
    is_pushed: true,
  })
  if (error) throw error
  return 1
}
