import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { IdeaCategory, IdeasSubTab } from '../types/ideas'
import { IdeaCategorySettings } from './IdeaCategorySettings'
import { IdeaChatView } from './IdeaChatView'
import { IdeaPendingList } from './IdeaPendingList'

const SUB_TABS: Array<{ id: IdeasSubTab; label: string; phase: string }> = [
  { id: 'chat', label: '對話', phase: 'P0' },
  { id: 'pending', label: '待決策', phase: 'P0' },
  { id: 'categories', label: '分類', phase: 'P0' },
  { id: 'map', label: '地圖', phase: 'P2' },
  { id: 'goals', label: '目標', phase: 'P3' },
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
    <section className="ideas-panel pixel-panel">
      <nav className="module-tabs ideas-sub-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={subTab === t.id ? 'tab active' : 'tab'}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {subTab === 'chat' ? (
          <button type="button" className="btn mini ideas-new-btn" onClick={startNewChat}>＋ 新想法</button>
        ) : null}
      </nav>

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
        <IdeaPendingList
          key={pendingBump}
          categories={categories}
          onOpen={openFromPending}
        />
      ) : null}

      {subTab === 'categories' ? (
        <IdeaCategorySettings onMessage={onMessage} />
      ) : null}

      {subTab === 'map' || subTab === 'goals' ? (
        <div className="ideas-coming-soon pixel-panel">
          <h2>即將推出</h2>
          <p className="muted">
            {subTab === 'map' ? '敘事地圖（P2）' : '目標計劃與任務（P3）'} — 請先完成 P0 驗收後再開發。
          </p>
        </div>
      ) : null}
    </section>
  )
}
