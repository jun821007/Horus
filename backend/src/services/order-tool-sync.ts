import { config } from '../config.js'
import { fetchIntegrationJson } from '../lib/integration-fetch.js'
import { syncShippingTrackFromOrderTool } from './shipping.js'

type OrderToolShippedItem = {
  tracking_number: string
  content_summary: string
  friend_name: string
  remark: string
  china_tracking: string
  shipped_at: string | null
  shipping_method: string
}

type OrderToolShippedResponse = {
  ok: boolean
  period_days: number
  count: number
  items: OrderToolShippedItem[]
}

export async function fetchOrderToolShippedTracks(days = 7): Promise<OrderToolShippedResponse | null> {
  if (!config.orderToolApiBaseUrl || !config.orderToolHorusReadSecret) return null
  return fetchIntegrationJson<OrderToolShippedResponse>(
    config.orderToolApiBaseUrl,
    '/api/horus/shipped-tracks',
    config.orderToolHorusReadSecret,
    { days },
  )
}

export async function runOrderToolSyncCron(days = 7): Promise<{
  source: 'order-tool' | 'skipped'
  period_days: number
  synced: number
  arrived: number
}> {
  const data = await fetchOrderToolShippedTracks(days)
  if (!data) return { source: 'skipped', period_days: days, synced: 0, arrived: 0 }

  let synced = 0
  let arrived = 0
  for (const item of data.items ?? []) {
    const result = await syncShippingTrackFromOrderTool({
      tracking_number: item.tracking_number,
      content_summary: item.content_summary || [item.friend_name, item.remark].filter(Boolean).join(' · '),
      source_meta: {
        source: 'order-tool',
        friend_name: item.friend_name,
        remark: item.remark,
        china_tracking: item.china_tracking,
        shipped_at: item.shipped_at,
        shipping_method: item.shipping_method,
        deep_link: config.orderToolAppUrl || config.orderToolApiBaseUrl,
      },
    })
    synced += 1
    if (result.arrived) arrived += 1
  }

  return { source: 'order-tool', period_days: data.period_days ?? days, synced, arrived }
}
