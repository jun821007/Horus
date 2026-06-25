import { normalizeTrackingNumber, resolveCarrier, type Carrier } from '../lib/carrier.js'
import { getSupabase } from '../lib/supabase.js'
import { queryCarrierStatus } from '../lib/tracking-provider.js'
import { notifyArrival } from './reminders.js'

const ARRIVED_RETENTION_DAYS = 7

async function markArrived(
  sb: ReturnType<typeof getSupabase>,
  trackingNumber: string,
  carrier: Carrier,
  contentSummary: string,
  statusText: string,
): Promise<boolean> {
  const now = new Date().toISOString()
  await sb
    .from('shipping_tracks')
    .update({
      status: '已到貨',
      last_check_date: now,
      arrived_at: now,
      status_text: statusText,
    })
    .eq('tracking_number', trackingNumber)
  await notifyArrival(carrier, trackingNumber, contentSummary)
  return true
}

export async function syncShippingTrackFromOrderTool(input: {
  tracking_number: string
  content_summary: string
  shipping_method?: string | null
  source_meta?: Record<string, unknown>
  query_carrier?: boolean
}): Promise<{ tracking_number: string; carrier: Carrier; arrived: boolean }> {
  const carrier = resolveCarrier(input.tracking_number, input.shipping_method)
  const tn = normalizeTrackingNumber(input.tracking_number, carrier)
  if (!tn) throw new Error('invalid tracking number')
  const sb = getSupabase()

  const { data: existing } = await sb
    .from('shipping_tracks')
    .select('status, content_summary')
    .eq('tracking_number', tn)
    .maybeSingle()

  let status = existing?.status === '已到貨' ? '已到貨' : '運輸中'
  let arrived = false
  let statusText: string | null = null
  const contentSummary = input.content_summary || existing?.content_summary || ''
  const shouldQueryCarrier = input.query_carrier !== false && status !== '已到貨'

  if (shouldQueryCarrier) {
    const result = await queryCarrierStatus(carrier, tn)
    statusText = result.statusText
    if (result.delivered) {
      status = '已到貨'
      arrived = true
    }
  }

  const row: Record<string, unknown> = {
    tracking_number: tn,
    carrier,
    content_summary: contentSummary,
    status,
    raw_input: input.source_meta ? JSON.stringify(input.source_meta) : null,
  }
  if (shouldQueryCarrier) {
    row.last_check_date = new Date().toISOString()
    if (statusText) row.status_text = statusText
    if (arrived) row.arrived_at = new Date().toISOString()
  }

  const { error } = await sb.from('shipping_tracks').upsert(row, { onConflict: 'tracking_number' })
  if (error) throw error

  if (arrived && existing?.status !== '已到貨') {
    await notifyArrival(carrier, tn, contentSummary)
  }

  return { tracking_number: tn, carrier, arrived }
}

export async function runDailyTrackingCron(): Promise<{ checked: number; arrived: number; failed: number }> {
  const sb = getSupabase()
  const { data: rows, error } = await sb.from('shipping_tracks').select('*').eq('status', '運輸中')
  if (error) throw error

  let arrived = 0
  let failed = 0
  for (const row of rows ?? []) {
    const result = await queryCarrierStatus(row.carrier, row.tracking_number)
    const now = new Date().toISOString()
    await sb
      .from('shipping_tracks')
      .update({ last_check_date: now, status_text: result.statusText })
      .eq('tracking_number', row.tracking_number)

    if (/查詢失敗|驗證碼|OCR/.test(result.statusText)) failed += 1

    if (!result.delivered) continue
    const did = await markArrived(
      sb,
      row.tracking_number,
      row.carrier as Carrier,
      row.content_summary,
      result.statusText,
    )
    if (did) arrived += 1
  }

  return { checked: rows?.length ?? 0, arrived, failed }
}

export async function runCleanupDeliveredTracks(): Promise<{ deleted: number }> {
  const sb = getSupabase()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - ARRIVED_RETENTION_DAYS)
  const { data, error } = await sb
    .from('shipping_tracks')
    .delete()
    .eq('status', '已到貨')
    .lt('arrived_at', cutoff.toISOString())
    .select('tracking_number')
  if (error) throw error
  return { deleted: data?.length ?? 0 }
}
