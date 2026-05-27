import { getSupabase } from '../lib/supabase.js'
import { notifyShipAlert } from './reminders.js'

function taipeiTomorrowYmd(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const today = fmt.format(new Date())
  const d = new Date(`${today}T12:00:00+08:00`)
  d.setDate(d.getDate() + 1)
  return fmt.format(d)
}

export async function createLycheeShipment(input: {
  order_label: string
  target_ship_date: string
  items_summary?: string
}) {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('lychee_shipments')
    .insert({
      order_label: input.order_label,
      target_ship_date: input.target_ship_date,
      items_summary: input.items_summary ?? '',
      status: 'scheduled',
    })
    .select()
    .single()
  if (error) throw error

  await sb.from('reminders').insert({
    title: '荔枝出貨排程',
    body: `${input.order_label} 預計 ${input.target_ship_date} 出貨`,
    kind: 'general',
    target_ship_date: input.target_ship_date,
    is_read: false,
    is_pushed: false,
  })

  return data
}

export async function runShipReminderCron(): Promise<{ tomorrow: string; alerted: number }> {
  const tomorrow = taipeiTomorrowYmd()
  const sb = getSupabase()

  const { data: shipments, error } = await sb
    .from('lychee_shipments')
    .select('id')
    .eq('target_ship_date', tomorrow)
    .eq('status', 'scheduled')
  if (error) throw error

  if (!shipments?.length) {
    return { tomorrow, alerted: 0 }
  }

  const { data: existing } = await sb
    .from('reminders')
    .select('id')
    .eq('kind', 'ship_alert')
    .eq('target_ship_date', tomorrow)
    .gte('created_at', new Date(Date.now() - 20 * 3600 * 1000).toISOString())
    .limit(1)

  if (existing?.length) {
    return { tomorrow, alerted: 0 }
  }

  await notifyShipAlert()
  return { tomorrow, alerted: 1 }
}
