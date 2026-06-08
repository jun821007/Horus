import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { AppTab, SubPage } from '../types/app'

type ReminderItem = {
  id: string
  title: string
  body: string
  kind: string
  is_read: boolean
  created_at: string
  metadata?: { deep_link?: string } | null
}

type DashboardSummary = {
  ok: boolean
  upcoming_reminders: ReminderItem[]
  unread_total: number
  shipping_in_transit: number
  pending_ideas: number
}

type Props = {
  refreshKey: number
  onNavigateTab: (tab: AppTab) => void
  onOpenSub: (page: SubPage) => void
}

function kindLabel(kind: string): string {
  if (kind === 'ship_alert') return '荔枝'
  if (kind === 'hot_seller') return '熱銷'
  if (kind === 'arrival') return '到貨'
  return '提醒'
}

function kindChipClass(kind: string): string {
  if (kind === 'ship_alert') return 'chip'
  if (kind === 'hot_seller') return 'chip'
  if (kind === 'arrival') return 'chip success'
  return 'chip muted'
}

export function HomeDashboard({ refreshKey, onNavigateTab, onOpenSub }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  const load = useCallback(async () => {
    const data = await apiGet<DashboardSummary>('/api/dashboard/summary').catch(() => null)
    setSummary(data)
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  const upcoming = summary?.upcoming_reminders ?? []

  return (
    <div className="panel">
      <h2 className="page-title">今日總覽</h2>

      <div className="section-title">即將到來的提醒</div>
      {upcoming.length === 0 ? (
        <div className="empty-state">
          目前沒有未讀提醒
          <br />
          Cron 會把荔枝、熱銷、到貨寫入這裡
        </div>
      ) : (
        upcoming.map((r) => (
          <article
            key={r.id}
            className="card"
            onClick={() => onNavigateTab('reminders')}
            role="button"
            tabIndex={0}
          >
            <div className="card-header">
              <h3 className="card-title">{r.title}</h3>
              <span className={kindChipClass(r.kind)}>{kindLabel(r.kind)}</span>
            </div>
            {r.body ? <p className="card-meta">{r.body}</p> : null}
          </article>
        ))
      )}

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <button type="button" className="stat-card" onClick={() => onNavigateTab('reminders')}>
          <div className="stat-label">未讀提醒</div>
          <div className="stat-value">{summary?.unread_total ?? 0}</div>
          <div className="stat-hint">全部提醒</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigateTab('shipping')}>
          <div className="stat-label">運輸中</div>
          <div className="stat-value">{summary?.shipping_in_transit ?? 0}</div>
          <div className="stat-hint">單號追蹤</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigateTab('ideas')}>
          <div className="stat-label">待決策</div>
          <div className="stat-value gold">{summary?.pending_ideas ?? 0}</div>
          <div className="stat-hint">想法</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onOpenSub('profit')}>
          <div className="stat-label">毛利</div>
          <div className="stat-value gold">POS</div>
          <div className="stat-hint">快速記帳</div>
        </button>
      </div>
    </div>
  )
}
