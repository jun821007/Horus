import { detectCarrier, extractTrackingCandidates, type Carrier } from '../lib/carrier.js'
import { getSupabase } from '../lib/supabase.js'
import { queryCarrierStatus } from '../lib/tracking-provider.js'
import { notifyArrival } from './reminders.js'
import type { GeminiTrackingResult } from '../lib/gemini.js'

export async function upsertShippingTrack(input: {
  tracking_number: string
  content_summary: string
  carrier_hint?: string
  raw_input?: string
}): Promise<{ tracking_number: string; carrier: Carrier }> {
  const tn = input.tracking_number.replace(/\D/g, '')
  let carrier = (input.carrier_hint?.trim() as Carrier | undefined) ?? detectCarrier(tn)
  if (!carrier || !['新竹物流', '黑貓', '超商'].includes(carrier)) {
    carrier = detectCarrier(tn) ?? '新竹物流'
  }

  const sb = getSupabase()
  const { error } = await sb.from('shipping_tracks').upsert(
    {
      tracking_number: tn,
      carrier,
      content_summary: input.content_summary || '',
      status: '運輸中',
      last_check_date: new Date().toISOString(),
      raw_input: input.raw_input ?? null,
    },
    { onConflict: 'tracking_number' },
  )
  if (error) throw error
  return { tracking_number: tn, carrier }
}

export async function ingestTrackingFromGemini(data: GeminiTrackingResult, rawInput: string) {
  return upsertShippingTrack({
    tracking_number: data.tracking_number,
    content_summary: data.content_summary,
    carrier_hint: data.carrier_hint,
    raw_input: rawInput,
  })
}

export async function ingestTrackingFromText(text: string) {
  const candidates = extractTrackingCandidates(text)
  const tn = candidates[0]
  if (!tn) throw new Error('找不到單號')
  const content = text.replace(tn, '').replace(/[/／|,，]/g, ' ').trim()
  return upsertShippingTrack({ tracking_number: tn, content_summary: content, raw_input: text })
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
