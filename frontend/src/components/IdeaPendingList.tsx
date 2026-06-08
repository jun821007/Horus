import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { IdeaCategory, IdeaRecord } from '../types/ideas'

type Props = {
  categories: IdeaCategory[]
  onOpen: (ideaId: string) => void
}

function priorityChip(priority: string | null): string {
  if (priority === 'P0') return 'chip danger'
  if (priority === 'P1') return 'chip'
  return 'chip muted'
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
    <div className="panel">
      {items.length === 0 ? (
        <div className="empty-state">沒有待決策想法</div>
      ) : (
        items.map((idea) => (
          <button key={idea.id} type="button" className="card" style={{ width: '100%', textAlign: 'left' }} onClick={() => onOpen(idea.id)}>
            <div className="card-header">
              <h3 className="card-title">{idea.title}</h3>
              <span className={priorityChip(idea.priority)}>{idea.priority ?? '—'}</span>
            </div>
            <p className="card-meta">{catName(idea.category_id)} · {fmtDate(idea.updated_at)}</p>
          </button>
        ))
      )}
    </div>
  )
}
