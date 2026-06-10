import { getSupabase } from '../lib/supabase.js'
import {
  recentYearMonths,
  taipeiCurrentYearMonth,
  taipeiMonthRange,
  taipeiMonthRangeFor,
} from '../lib/taipei-month.js'
import { fetchPosHistory, getPosMonthProfit, posRowDateKey, posRowProfit } from './pos-profit.js'

export type ProfitCategory = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type ProfitAdjustment = {
  id: string
  category_id: string | null
  item_name: string
  net_profit: number
  profit_date: string
  note: string | null
  created_at: string
}

export type ProfitDayItem = {
  name: string
  profit: number
  source: 'pos' | 'custom'
}

export type ProfitDayBreakdown = {
  date: string
  total: number
  item_count: number
  items: ProfitDayItem[]
}

export type ProfitMonthHistory = {
  year_month: string
  period_start: string
  period_end: string
  month_total: number
  pos_profit: number
  custom_profit: number
}

export async function listProfitCategories(activeOnly = true): Promise<ProfitCategory[]> {
  const sb = getSupabase()
  let q = sb.from('profit_categories').select('*').order('sort_order')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as ProfitCategory[]
}

export async function createProfitCategory(name: string): Promise<ProfitCategory> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('分類名稱不可空白')
  const sb = getSupabase()
  const { data, error } = await sb.from('profit_categories').insert({ name: trimmed }).select().single()
  if (error) throw error
  return data as ProfitCategory
}

export async function deleteProfitCategory(id: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('profit_categories').delete().eq('id', id)
  if (error) throw error
}

export async function listMonthAdjustments(start: string, end: string) {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('profit_adjustments')
    .select('*, profit_categories(name)')
    .gte('profit_date', start)
    .lte('profit_date', end)
    .order('profit_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addProfitAdjustment(input: {
  category_id?: string | null
  item_name: string
  net_profit: number
  profit_date?: string
  note?: string
}) {
  const sb = getSupabase()
  const { start, end } = taipeiMonthRange()
  const profitDate = input.profit_date ?? end
  if (profitDate < start || profitDate > end) {
    throw new Error('加成日期須在本月範圍內')
  }
  const { data, error } = await sb
    .from('profit_adjustments')
    .insert({
      category_id: input.category_id ?? null,
      item_name: input.item_name.trim(),
      net_profit: input.net_profit,
      profit_date: profitDate,
      note: input.note?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteProfitAdjustment(id: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('profit_adjustments').delete().eq('id', id)
  if (error) throw error
}

function buildDailyBreakdown(
  posRows: Awaited<ReturnType<typeof getPosMonthProfit>>['rows'],
  adjustments: Awaited<ReturnType<typeof listMonthAdjustments>>,
): ProfitDayBreakdown[] {
  const dayMap = new Map<string, ProfitDayItem[]>()

  for (const row of posRows) {
    const profit = posRowProfit(row)
    const date = posRowDateKey(row)
    if (profit == null || !date) continue
    const items = dayMap.get(date) ?? []
    items.push({ name: row.itemName?.trim() || 'POS 項目', profit, source: 'pos' })
    dayMap.set(date, items)
  }

  for (const row of adjustments) {
    const date = row.profit_date
    const profit = Math.round(Number(row.net_profit))
    const items = dayMap.get(date) ?? []
    const cat = row as { profit_categories?: { name?: string } | null }
    const label = row.item_name?.trim() || cat.profit_categories?.name || '自定義收益'
    items.push({ name: label, profit, source: 'custom' })
    dayMap.set(date, items)
  }

  return [...dayMap.entries()]
    .map(([date, items]) => ({
      date,
      total: items.reduce((sum, i) => sum + i.profit, 0),
      item_count: items.length,
      items,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

function sumPosProfitForMonth(rows: Awaited<ReturnType<typeof getPosMonthProfit>>['rows'], start: string, end: string) {
  let total = 0
  for (const row of rows) {
    const profit = posRowProfit(row)
    const date = posRowDateKey(row)
    if (profit == null || !date || date < start || date > end) continue
    total += profit
  }
  return total
}

function sumCustomForMonth(adjustments: Awaited<ReturnType<typeof listMonthAdjustments>>, start: string, end: string) {
  return adjustments
    .filter((row) => row.profit_date >= start && row.profit_date <= end)
    .reduce((sum, row) => sum + Number(row.net_profit), 0)
}

export async function getMonthProfitSummary(yearMonth?: string) {
  const monthKey = yearMonth?.trim() || taipeiCurrentYearMonth()
  const { start, end, dayOfMonth, year_month } = taipeiMonthRangeFor(monthKey)
  const isCurrentMonth = year_month === taipeiCurrentYearMonth()

  const [posRes, adjustments, categories] = await Promise.all([
    getPosMonthProfit(year_month),
    listMonthAdjustments(start, end),
    listProfitCategories(true),
  ])

  const customTotal = adjustments.reduce((sum, row) => sum + Number(row.net_profit), 0)
  const byCategoryMap = new Map<string, { category_id: string | null; category_name: string; total: number }>()

  for (const row of adjustments) {
    const cat = row as { category_id: string | null; net_profit: number; profit_categories?: { name?: string } | null }
    const key = cat.category_id ?? 'none'
    const name = cat.profit_categories?.name ?? '未分類'
    const prev = byCategoryMap.get(key) ?? { category_id: cat.category_id, category_name: name, total: 0 }
    prev.total += Number(cat.net_profit)
    byCategoryMap.set(key, prev)
  }

  const posProfit = posRes.profit
  const monthTotal = posProfit + customTotal
  const dailyAverage = dayOfMonth > 0 ? Math.round(monthTotal / dayOfMonth) : 0

  return {
    year_month,
    is_current_month: isCurrentMonth,
    period_start: start,
    period_end: end,
    day_of_month: dayOfMonth,
    pos_profit: posProfit,
    custom_profit: customTotal,
    month_total: monthTotal,
    daily_average: dailyAverage,
    pos_source: posRes.source,
    custom_by_category: [...byCategoryMap.values()],
    adjustments,
    categories,
    daily_breakdown: buildDailyBreakdown(posRes.rows, adjustments),
  }
}

export async function getProfitHistory(monthCount = 12): Promise<ProfitMonthHistory[]> {
  const months = recentYearMonths(monthCount)
  const oldest = months[months.length - 1]!
  const newest = months[0]!
  const rangeStart = taipeiMonthRangeFor(oldest).start
  const rangeEnd = taipeiMonthRangeFor(newest).end

  const [posRows, adjustments] = await Promise.all([
    fetchPosHistory(rangeStart, rangeEnd).catch(() => []),
    listMonthAdjustments(rangeStart, rangeEnd),
  ])

  return months.map((year_month) => {
    const { start, end } = taipeiMonthRangeFor(year_month)
    const posProfit = sumPosProfitForMonth(posRows, start, end)
    const customProfit = Math.round(sumCustomForMonth(adjustments, start, end))
    return {
      year_month,
      period_start: start,
      period_end: end,
      pos_profit: posProfit,
      custom_profit: customProfit,
      month_total: posProfit + customProfit,
    }
  })
}
