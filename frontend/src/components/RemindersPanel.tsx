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

  const unread = items.filter((r) => !r.is_read).length

  return (
    <div className="panel">
      <h2 className="page-title">提醒</h2>
      <p className="page-desc">{unread} 則未讀</p>
      {items.length === 0 ? (
        <div className="empty-state">尚無提醒</div>
      ) : (
        items.map((r) => (
          <article key={r.id} className="card" style={{ opacity: r.is_read ? 0.6 : 1 }}>
            <div className="card-header">
              <h3 className="card-title">{r.title}</h3>
              {!r.is_read ? <span className="chip danger">未讀</span> : <span className="chip muted">已讀</span>}
            </div>
            <p className="card-meta">{r.body}</p>
            {!r.is_read ? (
              <div className="card-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => void markRead(r.id)}>標記已讀</button>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  )
}
