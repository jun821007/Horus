import { getSupabase } from '../lib/supabase.js'
import type { GeminiTaobaoResult } from '../lib/gemini.js'

export function calcTaobaoCosts(rmb: number, twd: number, qty: number) {
  const exchangeRate = rmb > 0 ? twd / rmb : 0
  const unitCostTwd = qty > 0 ? twd / qty : twd
  return { exchangeRate, unitCostTwd }
}

export async function createDraftFromOcr(data: GeminiTaobaoResult) {
  const qty = data.quantity
  const { exchangeRate, unitCostTwd } = calcTaobaoCosts(data.rmb_amount, data.twd_amount, qty)
  const sb = getSupabase()

  const { data: draft, error: draftErr } = await sb
    .from('inventory_drafts')
    .insert({
      item_name: data.item_name,
      quantity: qty,
      rmb_amount: data.rmb_amount,
      twd_amount: data.twd_amount,
      exchange_rate: exchangeRate,
      unit_cost_twd: unitCostTwd,
      status: 'pending',
    })
    .select()
    .single()
  if (draftErr) throw draftErr

  const { error: expErr } = await sb.from('financial_expenses').insert({
    amount_twd: data.twd_amount,
    category: '採購成本支出',
    memo: `${data.item_name} x${qty} RMB${data.rmb_amount}`,
    inventory_draft_id: draft.id,
  })
  if (expErr) throw expErr

  return { draft, exchangeRate, unitCostTwd }
}

export async function confirmDraft(draftId: string) {
  const sb = getSupabase()

  const { data: draft, error: fetchErr } = await sb
    .from('inventory_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('status', 'pending')
    .single()
  if (fetchErr || !draft) throw new Error('草稿不存在或已處理')

  const { data: existing } = await sb
    .from('inventories')
    .select('id, quantity')
    .eq('item_name', draft.item_name)
    .maybeSingle()

  if (existing) {
    const { error: updErr } = await sb
      .from('inventories')
      .update({
        quantity: Number(existing.quantity) + Number(draft.quantity),
        unit_cost_twd: draft.unit_cost_twd,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updErr) throw updErr
  } else {
    const { error: insErr } = await sb.from('inventories').insert({
      item_name: draft.item_name,
      quantity: draft.quantity,
      unit_cost_twd: draft.unit_cost_twd,
    })
    if (insErr) throw insErr
  }

  const { error: delErr } = await sb.from('inventory_drafts').delete().eq('id', draftId)
  if (delErr) throw delErr

  return { item_name: draft.item_name, quantity_added: draft.quantity }
}
