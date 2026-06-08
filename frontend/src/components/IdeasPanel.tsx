import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { IdeaCategory, IdeasSubTab } from '../types/ideas'
import { IdeaCategorySettings } from './IdeaCategorySettings'
import { IdeaChatView } from './IdeaChatView'
import { IdeaPendingList } from './IdeaPendingList'

const SUB_TABS: Array<{ id: IdeasSubTab; label: string }> = [
  { id: 'chat', label: '對話' },
  { id: 'pending', label: '待決策' },
  { id: 'categories', label: '分類' },
]

type Props = {
  onMessage: (text: string, err?: boolean) => void
}

export function IdeasPanel({ onMessage }: Props) {
  const [subTab, setSubTab] = useState<IdeasSubTab>('chat')
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
    setSubTab('chat')
  }

  const startNewChat = () => {
    setActiveIdeaId(null)
    setSubTab('chat')
  }

  return (
    <div className="ideas-panel panel">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h2 className="page-title" style={{ flex: 1, margin: 0 }}>想法</h2>
        {subTab === 'chat' ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={startNewChat}>＋ 新想法</button>
        ) : null}
      </div>

      <div className="segmented">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? 'segmented-btn active' : 'segmented-btn'}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'chat' ? (
        <IdeaChatView
          ideaId={activeIdeaId}
          categories={categories}
          onMessage={onMessage}
          onIdeaCreated={(id) => setActiveIdeaId(id)}
          onDecision={() => setPendingBump((n) => n + 1)}
        />
      ) : null}

      {subTab === 'pending' ? (
        <IdeaPendingList key={pendingBump} categories={categories} onOpen={openFromPending} />
      ) : null}

      {subTab === 'categories' ? <IdeaCategorySettings onMessage={onMessage} /> : null}
    </div>
  )
}
