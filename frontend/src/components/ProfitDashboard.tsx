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
    <div className="panel">
      <div className="stat-grid">
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-label">今日累計</div>
          <div className="stat-value gold">${Math.round(summary.today).toLocaleString()}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-label">歷史累計</div>
          <div className="stat-value">${Math.round(summary.total).toLocaleString()}</div>
        </div>
      </div>
      <form className="inline-form card" onSubmit={(e) => void checkout(e)}>
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="品項" />
        <input value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} placeholder="銷售金額 TWD" inputMode="decimal" />
        <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="數量" inputMode="numeric" />
        <button type="submit" className="btn btn-primary">POS 結帳</button>
      </form>
    </div>
  )
}
