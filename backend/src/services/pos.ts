import { getSupabase } from '../lib/supabase.js'

export async function recordPosSale(input: {
  item_name: string
  quantity?: number
  sale_amount: number
  order_ref?: string
}) {
  const qty = Math.max(1, input.quantity ?? 1)
  const sb = getSupabase()

  const { data: inv } = await sb
    .from('inventories')
    .select('unit_cost_twd, quantity')
    .eq('item_name', input.item_name)
    .maybeSingle()

  const unitCost = Number(inv?.unit_cost_twd ?? 0)
  const costAmount = unitCost * qty
  const netProfit = input.sale_amount - costAmount

  const { data: profitRow, error: profitErr } = await sb
    .from('daily_profits')
    .insert({
      net_profit: netProfit,
      sale_amount: input.sale_amount,
      cost_amount: costAmount,
      item_name: input.item_name,
      quantity: qty,
      order_ref: input.order_ref ?? null,
    })
    .select()
    .single()
  if (profitErr) throw profitErr

  if (inv && Number(inv.quantity) >= qty) {
    await sb
      .from('inventories')
      .update({
        quantity: Number(inv.quantity) - qty,
        updated_at: new Date().toISOString(),
      })
      .eq('item_name', input.item_name)
  }

  return { net_profit: netProfit, row: profitRow }
}

export async function getProfitSummary() {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('daily_profits')
    .select('net_profit, profit_date')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' }).format(new Date())
  let todayTotal = 0
  let allTotal = 0
  for (const row of data ?? []) {
    const p = Number(row.net_profit)
    allTotal += p
    if (row.profit_date === today) todayTotal += p
  }
  return { today: todayTotal, total: allTotal, recent: data?.slice(0, 20) ?? [] }
}
