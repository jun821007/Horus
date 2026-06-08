import { detectCarrier, type Carrier } from '../lib/carrier.js'
import { getSupabase } from '../lib/supabase.js'
import { queryCarrierStatus } from '../lib/tracking-provider.js'
import { notifyArrival } from './reminders.js'

export async function syncShippingTrackFromOrderTool(input: {
  tracking_number: string
  content_summary: string
  source_meta?: Record<string, unknown>
}): Promise<{ tracking_number: string; carrier: Carrier; arrived: boolean }> {
  const tn = input.tracking_number.replace(/\D/g, '')
  if (!tn) throw new Error('invalid tracking number')

  const carrier = detectCarrier(tn) ?? '新竹物流'
  const sb = getSupabase()

  const { data: existing } = await sb
    .from('shipping_tracks')
    .select('status, content_summary')
    .eq('tracking_number', tn)
    .maybeSingle()

  let status = existing?.status === '已到貨' ? '已到貨' : '運輸中'
  let arrived = false

  if (status !== '已到貨') {
    const result = await queryCarrierStatus(carrier, tn)
    if (result.delivered) {
      status = '已到貨'
      arrived = true
    }
  }

  const contentSummary = input.content_summary || existing?.content_summary || ''
  const { error } = await sb.from('shipping_tracks').upsert(
    {
      tracking_number: tn,
      carrier,
      content_summary: contentSummary,
      status,
      last_check_date: new Date().toISOString(),
      raw_input: input.source_meta ? JSON.stringify(input.source_meta) : null,
    },
    { onConflict: 'tracking_number' },
  )
  if (error) throw error

  if (arrived && existing?.status !== '已到貨') {
    await notifyArrival(carrier, tn, contentSummary)
  }

  return { tracking_number: tn, carrier, arrived }
}

export async function runDailyTrackingCron(): Promise<{ checked: number; arrived: number }> {
  const sb = getSupabase()
  const { data: rows, error } = await sb
    .from('shipping_tracks')
    .select('*')
    .eq('status', '運輸中')
  if (error) throw error

  let arrived = 0
  for (const row of rows ?? []) {
    const result = await queryCarrierStatus(row.carrier, row.tracking_number)
    await sb
      .from('shipping_tracks')
      .update({ last_check_date: new Date().toISOString() })
      .eq('tracking_number', row.tracking_number)

    if (!result.delivered) continue

    await sb
      .from('shipping_tracks')
      .update({ status: '已到貨', last_check_date: new Date().toISOString() })
      .eq('tracking_number', row.tracking_number)

    await notifyArrival(row.carrier, row.tracking_number, row.content_summary)
    arrived += 1
  }

  return { checked: rows?.length ?? 0, arrived }
}
