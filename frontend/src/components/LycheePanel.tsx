import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

type Shipment = {
  id: string
  order_label: string
  target_ship_date: string
  items_summary: string
  status: string
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
}

export function LycheePanel({ refreshKey, onMessage }: Props) {
  const [items, setItems] = useState<Shipment[]>([])
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [summary, setSummary] = useState('')

  const load = () => {
    void apiGet<{ items: Shipment[] }>('/api/lychee-shipments').then((d) => setItems(d.items)).catch(() => setItems([]))
  }

  useEffect(() => { load() }, [refreshKey])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !date) {
      onMessage('請填寫出貨單名稱與日期', true)
      return
    }
    try {
      await apiPost('/api/lychee-shipments', {
        order_label: label,
        target_ship_date: date,
        items_summary: summary,
      })
      onMessage('已建立荔枝出貨排程')
      setLabel('')
      setSummary('')
      load()
    } catch (err) {
      onMessage(String(err), true)
    }
  }

  return (
    <div className="panel">
      <form className="inline-form card" onSubmit={(e) => void submit(e)}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="出貨單名稱" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="品項摘要（選填）" />
        <button type="submit" className="btn btn-primary">新增排程</button>
      </form>
      {items.map((s) => (
        <article key={s.id} className="card">
          <div className="card-header">
            <h3 className="card-title">{s.order_label}</h3>
            <span className="chip">{s.target_ship_date}</span>
          </div>
          <p className="card-meta">{s.items_summary || s.status}</p>
        </article>
      ))}
    </div>
  )
}
