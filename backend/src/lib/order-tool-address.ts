import { normalizeTrackingNumber, carrierFromShippingMethod } from './carrier.js'

type OrderToolGroup = {
  tracking_id_taiwan?: string
  shipping_method?: string
  shipping_address?: string
}

type OrderToolData = {
  taiwan_parcel_groups?: OrderToolGroup[]
}

function parseTaiwanTrackingIds(raw: string): string[] {
  const normalized = raw.replaceAll('，', ',').replaceAll('\r', '\n')
  const parts = normalized
    .split(',')
    .flatMap((part) => part.split('\n'))
    .map((line) => line.trim())
    .filter(Boolean)
  return [...new Set(parts)]
}

function normalizeForLookup(rawId: string, shippingMethod: string): string {
  const carrier = carrierFromShippingMethod(shippingMethod)
  return normalizeTrackingNumber(rawId, carrier)
}

export function findShippingAddressInData(data: OrderToolData, trackingNumber: string): string {
  const target = trackingNumber.trim()
  if (!target) return ''

  for (const group of data.taiwan_parcel_groups ?? []) {
    const rawTaiwanId = (group.tracking_id_taiwan || '').trim()
    if (!rawTaiwanId || rawTaiwanId.startsWith('__UNSET_TW__')) continue

    const method = (group.shipping_method || '').trim()
    for (const rawId of parseTaiwanTrackingIds(rawTaiwanId)) {
      if (normalizeForLookup(rawId, method) === target) {
        return (group.shipping_address || '')
          .trim()
          .replace(/\t+/g, ' ')
          .replace(/\s{2,}/g, ' ')
      }
    }
  }

  return ''
}

export async function fetchShippingAddressFromOrderToolData(
  baseUrl: string,
  trackingNumber: string,
): Promise<string> {
  const url = new URL('/api/order-tool/data', baseUrl.replace(/\/$/, '') + '/')
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) return ''
  const data = (await res.json()) as OrderToolData
  return findShippingAddressInData(data, trackingNumber)
}
