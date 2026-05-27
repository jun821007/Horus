import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { supabase } from '../lib/supabase'

type Summary = {
  today: number
  total: number
  recent: Array<{ net_profit: number; profit_date: string }>
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
}

export function ProfitDashboard({ refreshKey, onMessage }: Props) {
  const [summary, setSummary] = useState<Summary>({ today: 0, total: 0, recent: [] })
  const [itemName, setItemName] = useState('')
  const [saleAmount, setSaleAmount] = useState('')
  const [qty, setQty] = useState('1')

  const load = () => {
    void apiGet<Summary>('/api/profits/summary').then(setSummary).catch(() => {})
  }

  useEffect(() => { load() }, [refreshKey])

  useEffect(() => {
    const client = supabase
    if (!client) return
    const ch = client
      .channel('horus-profits')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_profits' }, () => load())
      .subscribe()
    return () => { void client.removeChannel(ch) }
  }, [])

  const checkout = async (e: React.FormEvent) => {
    e.preventDefault()
    const sale = Number(saleAmount)
    if (!itemName.trim() || !Number.isFinite(sale)) {
      onMessage('請填寫品項與銷售金額', true)
      return
    }
    try {
      const res = await apiPost<{ net_profit: number }>('/api/pos/checkout', {
        item_name: itemName,
        sale_amount: sale,
        quantity: Number(qty) || 1,
      })
      onMessage(`純毛利 +${res.net_profit} 元`)
      setSaleAmount('')
      load()
    } catch (err) {
      onMessage(String(err), true)
    }
  }

  return (
    <section className="pixel-panel">
      <h2>荷魯斯之眼 · 純毛利</h2>
      <div className="stat-row">
        <span>今日累計</span>
        <span className="stat-value">${Math.round(summary.today).toLocaleString()}</span>
      </div>
      <div className="stat-row">
        <span>歷史累計</span>
        <span className="stat-value">${Math.round(summary.total).toLocaleString()}</span>
      </div>
      <form className="inline-form" onSubmit={(e) => void checkout(e)}>
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="品項（對應 inventories）" />
        <input value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="銷售金額 TWD" inputMode="decimal" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="數量" inputMode="numeric" />
        <button type="submit" className="btn btn-primary">POS 結帳記帳</button>
      </form>
      <p className="muted" style={{ marginTop: 10 }}>
        即時監聽 daily_profits 更新（需設定 VITE_SUPABASE_*）
      </p>
    </section>
  )
}
