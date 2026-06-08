import { getSupabase } from '../lib/supabase.js'

export type ReminderKind = 'general' | 'arrival' | 'ship_alert' | 'system' | 'hot_seller'

export async function pushReminder(
  title: string,
  body: string,
  kind: ReminderKind,
  extra?: {
    target_ship_date?: string
    related_tracking?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('reminders').insert({
    title,
    body,
    kind,
    is_read: false,
    is_pushed: true,
    target_ship_date: extra?.target_ship_date ?? null,
    related_tracking: extra?.related_tracking ?? null,
    metadata: extra?.metadata ?? null,
  })
  if (error) throw error
}

export async function notifyArrival(carrier: string, trackingNumber: string, contentSummary: string): Promise<void> {
  const body = carrier + ' ' + trackingNumber + ' 已到貨。' + (contentSummary || '（未填）') + ' — 請領貨'
  await pushReminder('【到貨】請領貨', body, 'arrival', { related_tracking: trackingNumber })
}
