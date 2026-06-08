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
    <div className="panel">
      <h2 className="page-title">單號追蹤</h2>
      <p className="page-desc">{items.length} 筆追蹤中</p>
      {items.length === 0 ? (
        <div className="empty-state">尚無追蹤單號<br />點右下角 ＋ 快速輸入</div>
      ) : (
        items.map((t) => (
          <article key={t.tracking_number} className="card">
            <div className="card-header">
              <h3 className="card-title">{t.tracking_number}</h3>
              <span className={t.status === '已到貨' ? 'chip success' : 'chip muted'}>{t.status}</span>
            </div>
            <p className="card-meta">
              <span className="chip">{t.carrier}</span>
            </p>
            <p className="card-meta">{t.content_summary || '—'}</p>
          </article>
        ))
      )}
    </div>
  )
}
