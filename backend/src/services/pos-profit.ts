import { config } from '../config.js'
import { taipeiMonthRange } from '../lib/taipei-month.js'

export type PosHistoryRow = {
  orderId?: string
  itemName?: string
  itemId?: string
  type?: string
  salePrice?: number
  cost?: number
  profit?: number | string | null
  status?: string
  category?: string
}

export function computePosPeriodProfit(rows: PosHistoryRow[]): number {
  let profit = 0
  for (const i of rows) {
    if (i.status === 'Returned' || i.status === 'Deleted') continue
    if (i.category === '調整入庫') continue
    if (i.type === 'expense' || i.type === 'restock' || i.type === 'salary') continue

    const sale = Number(i.salePrice) || 0
    const cost = Number(i.cost) || 0
    const isMultiExtra = i.type === 'phone' && sale === 0 && (i.itemName ?? '').includes(' + ')
    if (isMultiExtra) continue

    const iProfit =
      i.profit !== undefined && i.profit !== null && i.profit !== ''
        ? Number(i.profit)
        : sale - cost

    if (i.status === 'Completed' && i.type !== 'wrap') profit += iProfit
  }
  return Math.round(profit)
}

export async function fetchPosHistory(start: string, end: string): Promise<PosHistoryRow[]> {
  if (!config.posApiBaseUrl) return []
  const base = config.posApiBaseUrl.replace(/\/$/, '')
  const url = `${base}/api/history?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POS history ${res.status}: ${text}`)
  }
  const json = await res.json()
  return Array.isArray(json) ? (json as PosHistoryRow[]) : []
}

export async function getPosMonthProfit(): Promise<{ profit: number; start: string; end: string; source: 'pos' | 'skipped' }> {
  const { start, end } = taipeiMonthRange()
  if (!config.posApiBaseUrl) return { profit: 0, start, end, source: 'skipped' }
  const rows = await fetchPosHistory(start, end)
  return { profit: computePosPeriodProfit(rows), start, end, source: 'pos' }
}
