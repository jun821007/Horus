import { getSupabase } from '../lib/supabase.js'
import { taipeiMonthRange } from '../lib/taipei-month.js'
import { getPosMonthProfit } from './pos-profit.js'

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

export async function getMonthProfitSummary() {
  const { start, end, dayOfMonth } = taipeiMonthRange()
  const [posRes, adjustments, categories] = await Promise.all([
    getPosMonthProfit(),
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
  }
}
