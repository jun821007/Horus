import { taipeiYmd } from '../lib/taipei-date.js'
import { getSupabase } from '../lib/supabase.js'

export type ReminderKind = 'general' | 'arrival' | 'ship_alert' | 'system' | 'hot_seller'

export type ReminderVisibility = {
  kind: string
  is_read: boolean
  target_ship_date?: string | null
}

export function isExpiredShipAlert(
  reminder: Pick<ReminderVisibility, 'kind' | 'target_ship_date'>,
  today = taipeiYmd(),
): boolean {
  if (reminder.kind !== 'ship_alert') return false
  const date = (reminder.target_ship_date || '').trim()
  if (!date) return false
  return date < today
}

export function isVisibleUnreadReminder(reminder: ReminderVisibility): boolean {
  if (reminder.is_read) return false
  if (reminder.kind === 'hot_seller') return false
  if (isExpiredShipAlert(reminder)) return false
  return true
}

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
