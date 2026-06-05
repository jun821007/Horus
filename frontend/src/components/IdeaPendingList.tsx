import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import { priorityClass } from '../lib/ideas'
import type { IdeaCategory, IdeaRecord } from '../types/ideas'

type Props = {
  categories: IdeaCategory[]
  onOpen: (ideaId: string) => void
}

export function IdeaPendingList({ categories, onOpen }: Props) {
  const [items, setItems] = useState<IdeaRecord[]>([])

  const load = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; items: IdeaRecord[] }>('/api/ideas?status=pending')
    const sorted = [...res.items].sort((a, b) => {
      const ma = a.priority_manual ?? 9999
      const mb = b.priority_manual ?? 9999
      if (ma !== mb) return ma - mb
      const pa = a.priority === 'P0' ? 0 : a.priority === 'P1' ? 1 : 2
      const pb = b.priority === 'P0' ? 0 : b.priority === 'P1' ? 1 : 2
      if (pa !== pb) return pa - pb
      return b.created_at.localeCompare(a.created_at)
    })
    setItems(sorted)
  }, [])

  useEffect(() => { void load().catch(() => setItems([])) }, [load])

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <section className="pixel-panel ideas-pending">
      <h2>待決策 ({items.length})</h2>
      {items.length === 0 ? (
        <p className="muted">沒有待決策想法，去對話 Tab 輸入吧</p>
      ) : (
        <ul className="ideas-pending-list">
          {items.map((idea) => (
            <li key={idea.id}>
              <button type="button" className="ideas-pending-row" onClick={() => onOpen(idea.id)}>
                <span className={priorityClass(idea.priority)}>{idea.priority ?? '—'}</span>
                <span className="ideas-pending-cat">{catName(idea.category_id)}</span>
                <span className="ideas-pending-title">{idea.title}</span>
                <span className="muted ideas-pending-date">{fmtDate(idea.updated_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted ideas-pending-hint">P1 將支援拖曳排序 · AI 建議僅供參考</p>
    </section>
  )
}
