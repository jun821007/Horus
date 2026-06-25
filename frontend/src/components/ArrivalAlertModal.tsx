import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../lib/api'
import { supabase } from '../lib/supabase'

type ArrivalReminder = {
  id: string
  title: string
  body: string
  kind: string
}

type Props = {
  refreshKey: number
  onAcknowledged: () => void
}

export function ArrivalAlertModal({ refreshKey, onAcknowledged }: Props) {
  const [items, setItems] = useState<ArrivalReminder[]>([])

  const load = useCallback(async () => {
    const data = await apiGet<{ items: ArrivalReminder[] }>('/api/reminders').catch(() => ({ items: [] }))
    setItems(data.items.filter((r) => r.kind === 'arrival'))
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  useEffect(() => {
    const client = supabase
    if (!client) return

    const ch = client
      .channel('horus-arrival-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reminders' }, (payload) => {
        const row = payload.new as ArrivalReminder
        if (row.kind !== 'arrival') return
        setItems((prev) => (prev.some((r) => r.id === row.id) ? prev : [row, ...prev]))
      })
      .subscribe()

    return () => {
      void client.removeChannel(ch)
    }
  }, [])

  const acknowledge = async () => {
    const ids = items.map((i) => i.id)
    if (ids.length === 0) return
    setItems([])
    await Promise.all(ids.map((id) => apiPatch(`/api/reminders/${id}/read`).catch(() => null)))
    onAcknowledged()
  }

  if (items.length === 0) return null

  return (
    <div className="arrival-overlay" role="dialog" aria-modal="true" aria-labelledby="arrival-modal-title">
      <div className="arrival-modal">
        <h2 id="arrival-modal-title" className="arrival-modal-title">📦 到貨通知</h2>
        <p className="arrival-modal-desc">{items.length} 筆已到貨，請安排領貨</p>
        <ul className="arrival-modal-list">
          {items.map((r) => (
            <li key={r.id} className="arrival-modal-item">
              <div className="arrival-modal-item-title">{r.title}</div>
              {r.body ? <div className="arrival-modal-item-body">{r.body}</div> : null}
            </li>
          ))}
        </ul>
        <button type="button" className="btn btn-primary arrival-modal-btn" onClick={() => void acknowledge()}>
          知道了
        </button>
      </div>
    </div>
  )
}

