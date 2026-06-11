import { config } from '../config.js'
import { formatShippingDisplay, parseLegacyContentSummary, type ParcelLine } from '../lib/shipping-display.js'
import { fetchIntegrationJson } from '../lib/integration-fetch.js'
import { fetchShippingAddressFromOrderToolData } from '../lib/order-tool-address.js'
import { syncShippingTrackFromOrderTool } from './shipping.js'

type OrderToolShippedItem = {
  tracking_number: string
  shipping_address?: string
  parcel_items?: ParcelLine[]
  content_summary?: string
  friend_name: string
  remark: string
  china_tracking: string
  shipped_at: string | null
  shipping_method: string
}

function resolveParcelItems(item: OrderToolShippedItem): ParcelLine[] {
  const fromApi = item.parcel_items ?? []
  const legacy = parseLegacyContentSummary(item.content_summary ?? '')

  if (legacy.length > fromApi.length) return legacy
  if (fromApi.length > 0) return fromApi
  if (legacy.length > 0) return legacy

  const name = (item.friend_name || '').trim()
  const remark = (item.remark || '').trim()
  if (name || remark) return [{ friend_name: name, remark }]
  return []
}

async function lookupShippingAddressFromApi(trackingNumber: string, shippingMethod?: string): Promise<string> {
  if (!config.orderToolApiBaseUrl || !config.orderToolHorusReadSecret) return ''
  try {
    const res = await fetchIntegrationJson<{ ok: boolean; shipping_address?: string }>(
      config.orderToolApiBaseUrl,
      '/api/horus/address-by-tracking',
      config.orderToolHorusReadSecret,
      { tracking: trackingNumber, method: shippingMethod || '' },
    )
    return (res.shipping_address || '').trim()
  } catch {
    return ''
  }
}

async function resolveShippingAddress(item: OrderToolShippedItem): Promise<string> {
  const direct = (item.shipping_address || '').trim()
  if (direct) return direct

  const fromApi = await lookupShippingAddressFromApi(item.tracking_number, item.shipping_method)
  if (fromApi) return fromApi

  if (!config.orderToolApiBaseUrl) return ''
  try {
    return await fetchShippingAddressFromOrderToolData(config.orderToolApiBaseUrl, item.tracking_number)
  } catch {
    return ''
  }
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
    const parcelItems = resolveParcelItems(item)
    const shippingAddress = await resolveShippingAddress(item)

    const result = await syncShippingTrackFromOrderTool({
      tracking_number: item.tracking_number,
      content_summary: formatShippingDisplay(parcelItems, shippingAddress, item.shipped_at),
      shipping_method: item.shipping_method,
      source_meta: {
        source: 'order-tool',
        shipping_address: shippingAddress,
        parcel_items: parcelItems,
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
