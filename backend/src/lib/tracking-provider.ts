import type { Carrier } from './carrier.js'
import { config } from '../config.js'
import { queryHctPublicTracking } from './tracking/hct-public.js'
import { querySevenElevenTracking } from './tracking/seven-eleven.js'
import { sleep } from './tracking/http-session.js'

export type TrackingQueryResult = {
  delivered: boolean
  statusText: string
}

let lastQueryAt = 0

async function throttleQuery(): Promise<void> {
  const delay = config.trackingQueryDelayMs
  const now = Date.now()
  const wait = lastQueryAt + delay - now
  if (wait > 0) await sleep(wait)
  lastQueryAt = Date.now()
}

function mockDelivered(trackingNumber: string): TrackingQueryResult | null {
  if (!config.trackingMockDelivered.includes(trackingNumber)) return null
  return { delivered: true, statusText: '已送達（mock）' }
}

async function queryByScraper(carrier: Carrier, trackingNumber: string): Promise<TrackingQueryResult> {
  await throttleQuery()
  const maxAttempts = config.trackingMaxRetries

  if (carrier === '超商') {
    const res = await querySevenElevenTracking(trackingNumber, maxAttempts)
    return { delivered: res.delivered, statusText: res.statusText }
  }
  if (carrier === '新竹物流') {
    const res = await queryHctPublicTracking(trackingNumber, maxAttempts)
    return { delivered: res.delivered, statusText: res.statusText }
  }

  return { delivered: false, statusText: `${carrier} 尚未支援自動查詢` }
}

export async function queryCarrierStatus(
  carrier: string,
  trackingNumber: string,
): Promise<TrackingQueryResult> {
  const tn = trackingNumber.trim()
  const mocked = mockDelivered(tn)
  if (mocked) return mocked

  if (!config.trackingScrapeEnabled) {
    return { delivered: false, statusText: `${carrier} 查詢已停用` }
  }

  try {
    return await queryByScraper(carrier as Carrier, tn)
  } catch (e) {
    console.warn('[tracking]', carrier, tn, e)
    return { delivered: false, statusText: `${carrier} 查詢失敗` }
  }
}
