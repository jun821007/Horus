import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

type Track = {
  tracking_number: string
  carrier: string
  content_summary: string
  status: string
  last_check_date: string | null
}

export function ShippingPanel({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<Track[]>([])

  useEffect(() => {
    void apiGet<{ items: Track[] }>('/api/shipping-tracks').then((d) => setItems(d.items)).catch(() => setItems([]))
  }, [refreshKey])

  return (
    <section className="pixel-panel">
      <h2>單號追蹤</h2>
      <ul className="data-list">
        {items.length === 0 ? (
          <li className="muted">尚無追蹤單號</li>
        ) : (
          items.map((t) => (
            <li key={t.tracking_number}>
              <strong>{t.tracking_number}</strong>
              <span className="badge">{t.carrier}</span>
              <span className={t.status === '已到貨' ? 'badge arrived' : 'badge'}>{t.status}</span>
              <div className="muted">{t.content_summary || '—'}</div>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
