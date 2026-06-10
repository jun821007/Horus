import { config } from '../config.js'
import { taipeiMonthRange, taipeiMonthRangeFor } from '../lib/taipei-month.js'

export type PosHistoryRow = {
  time?: string
  date?: string
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

function parsePosRowDate(raw: string): Date | null {
  const normalized = raw.replace(/\s*下午\s*/g, ' ').replace(/\s*上午\s*/g, ' ')
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? null : d
}

export function posRowDateKey(row: PosHistoryRow): string | null {
  const raw = row.time ?? row.date
  if (!raw) return null
  const d = parsePosRowDate(String(raw))
  if (!d) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.appTimeZone || 'Asia/Taipei',
  }).format(d)
}

export function posRowProfit(row: PosHistoryRow): number | null {
  if (row.status === 'Returned' || row.status === 'Deleted') return null
  if (row.category === '調整入庫') return null
  if (row.type === 'expense' || row.type === 'restock' || row.type === 'salary') return null

  const sale = Number(row.salePrice) || 0
  const cost = Number(row.cost) || 0
  const isMultiExtra = row.type === 'phone' && sale === 0 && (row.itemName ?? '').includes(' + ')
  if (isMultiExtra) return null

  const iProfit =
    row.profit !== undefined && row.profit !== null && row.profit !== ''
      ? Number(row.profit)
      : sale - cost

  if (row.status === 'Completed' && row.type !== 'wrap') return Math.round(iProfit)
  return null
}

export function computePosPeriodProfit(rows: PosHistoryRow[]): number {
  let profit = 0
  for (const row of rows) {
    const p = posRowProfit(row)
    if (p != null) profit += p
  }
  return profit
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

export async function getPosMonthProfit(yearMonth?: string): Promise<{
  profit: number
  start: string
  end: string
  source: 'pos' | 'skipped'
  rows: PosHistoryRow[]
}> {
  const { start, end } = yearMonth ? taipeiMonthRangeFor(yearMonth) : taipeiMonthRange()
  if (!config.posApiBaseUrl) return { profit: 0, start, end, source: 'skipped', rows: [] }
  const rows = await fetchPosHistory(start, end)
  return { profit: computePosPeriodProfit(rows), start, end, source: 'pos', rows }
}
