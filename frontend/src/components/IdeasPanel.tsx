import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { IdeaCategory, IdeasSubTab } from '../types/ideas'
import { IdeaCaptureView } from './IdeaCaptureView'
import { IdeaCategorySettings } from './IdeaCategorySettings'
import { IdeaDetailView } from './IdeaDetailView'
import { IdeaPendingList } from './IdeaPendingList'

const SUB_TABS: Array<{ id: IdeasSubTab; label: string }> = [
  { id: 'capture', label: '靈感' },
  { id: 'pending', label: '待決策' },
  { id: 'categories', label: '分類' },
]

type Props = {
  onMessage: (text: string, err?: boolean) => void
}

export function IdeasPanel({ onMessage }: Props) {
  const [subTab, setSubTab] = useState<IdeasSubTab>('capture')
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [categories, setCategories] = useState<IdeaCategory[]>([])
  const [pendingBump, setPendingBump] = useState(0)

  const loadCategories = useCallback(async () => {
    const res = await apiGet<{ ok: boolean; items: IdeaCategory[] }>('/api/ideas/categories')
    setCategories(res.items)
  }, [])

  useEffect(() => { void loadCategories().catch(() => {}) }, [loadCategories])

  const openFromPending = (id: string) => {
    setActiveIdeaId(id)
  }

  const backToPendingList = () => {
    setActiveIdeaId(null)
    setPendingBump((n) => n + 1)
  }

  return (
    <div className="ideas-panel panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h2 className="page-title" style={{ flex: 1, margin: 0 }}>想法</h2>
      </div>

      <div className="segmented">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? 'segmented-btn active' : 'segmented-btn'}
            onClick={() => {
              setSubTab(t.id)
              if (t.id !== 'pending') setActiveIdeaId(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'capture' ? (
        <IdeaCaptureView
          onMessage={onMessage}
          onCaptured={() => setPendingBump((n) => n + 1)}
        />
      ) : null}

      {subTab === 'pending' && activeIdeaId ? (
        <IdeaDetailView
          ideaId={activeIdeaId}
          categories={categories}
          onBack={backToPendingList}
          onMessage={onMessage}
          onDecision={backToPendingList}
        />
      ) : null}

      {subTab === 'pending' && !activeIdeaId ? (
        <IdeaPendingList key={pendingBump} categories={categories} onOpen={openFromPending} />
      ) : null}

      {subTab === 'categories' ? <IdeaCategorySettings onMessage={onMessage} /> : null}
    </div>
  )
}
