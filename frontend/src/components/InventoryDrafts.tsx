import { useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'

type Draft = {
  id: string
  item_name: string
  quantity: number
  rmb_amount: number | null
  twd_amount: number
  exchange_rate: number | null
  unit_cost_twd: number
  created_at: string
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
  onConfirmed: () => void
}

export function InventoryDrafts({ refreshKey, onMessage, onConfirmed }: Props) {
  const [items, setItems] = useState<Draft[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = () => {
    void apiGet<{ items: Draft[] }>('/api/inventory-drafts').then((d) => setItems(d.items)).catch(() => setItems([]))
  }

  useEffect(() => { load() }, [refreshKey])

  const confirm = async (id: string) => {
    setBusyId(id)
    try {
      const res = await apiPost<{ ok: boolean; item_name: string; quantity_added: number }>(
        `/api/inventory-drafts/${id}/confirm`,
      )
      onMessage(`已入庫 ${res.item_name} +${res.quantity_added}`)
      onConfirmed()
      load()
    } catch (e) {
      onMessage(String(e), true)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="panel">
      {items.length === 0 ? (
        <div className="empty-state">無待確認草稿</div>
      ) : (
        items.map((d) => (
          <article key={d.id} className="card">
            <h3 className="card-title">{d.item_name} × {d.quantity}</h3>
            <p className="card-meta">
              RMB {d.rmb_amount ?? '—'} / TWD {d.twd_amount}<br />
              匯率 {Number(d.exchange_rate ?? 0).toFixed(2)} · 單件 {Number(d.unit_cost_twd).toFixed(2)} 元
            </p>
            <div className="card-actions">
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busyId === d.id} onClick={() => void confirm(d.id)}>
                {busyId === d.id ? '處理中…' : '確認入庫'}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
