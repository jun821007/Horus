import { useEffect, useState } from 'react'
import { apiGet, apiPatch } from '../lib/api'
import { supabase } from '../lib/supabase'

type Reminder = {
  id: string
  title: string
  body: string
  kind: string
  is_read: boolean
  created_at: string
}

export function RemindersPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Reminder[]>([])

  const load = () => {
    void apiGet<{ items: Reminder[] }>('/api/reminders').then((d) => setItems(d.items)).catch(() => setItems([]))
  }

  useEffect(() => { load() }, [refreshKey])

  useEffect(() => {
    const client = supabase
    if (!client) return
    const ch = client
      .channel('horus-reminders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reminders' }, () => load())
      .subscribe()
    return () => { void client.removeChannel(ch) }
  }, [])

  const markRead = async (id: string) => {
    await apiPatch(`/api/reminders/${id}/read`)
    load()
  }

  return (
    <section className="pixel-panel">
      <h2>提醒事項</h2>
      <ul className="data-list">
        {items.length === 0 ? (
          <li className="muted">尚無提醒</li>
        ) : (
          items.map((r) => (
            <li key={r.id} style={{ opacity: r.is_read ? 0.55 : 1 }}>
              <strong>{r.title}</strong>
              {!r.is_read ? (
                <button type="button" className="btn" style={{ marginLeft: 8 }} onClick={() => void markRead(r.id)}>
                  已讀
                </button>
              ) : null}
              <div>{r.body}</div>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
