import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { AppPage } from '../types/app'

type ReminderItem = {
  id: string
  title: string
  body: string
  kind: string
  is_read: boolean
  created_at: string
  metadata?: { deep_link?: string } | null
}

type CountdownItem = {
  id: string
  title: string
  due_date: string
  days_until: number
  days_label: string
  subtitle: string | null
  deep_link: string | null
}

type HotSellerItem = {
  category: string
  item_name: string
  outbound_qty: number
  rank: number
}

type DashboardSummary = {
  ok: boolean
  upcoming_reminders: ReminderItem[]
  next_countdown: CountdownItem | null
  hot_sellers: {
    period_label: string
    period_start: string
    period_end: string
    items: HotSellerItem[]
    deep_link: string | null
  }
  unread_total: number
  shipping_in_transit: number
  pending_ideas: number
  profit_month_total: number
  profit_daily_average: number
  profit_pos: number
  profit_custom: number
  profit_period_start: string | null
  profit_period_end: string | null
}

type Props = {
  refreshKey: number
  onNavigate: (page: AppPage) => void
  onOpenInput: () => void
}

function kindLabel(kind: string): string {
  if (kind === 'ship_alert') return '荔枝'
  if (kind === 'hot_seller') return '熱銷'
  if (kind === 'arrival') return '到貨'
  return '提醒'
}

function kindChipClass(kind: string): string {
  if (kind === 'arrival') return 'chip success'
  return 'chip muted'
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

function openExternal(url: string | null | undefined) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function HomeDashboard({ refreshKey, onNavigate, onOpenInput }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  const load = useCallback(async () => {
    const data = await apiGet<DashboardSummary>('/api/dashboard/summary').catch(() => null)
    setSummary(data)
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  const upcoming = summary?.upcoming_reminders ?? []
  const countdown = summary?.next_countdown
  const hotPreview =
    summary?.hot_sellers.items
      ?.slice(0, 3)
      .map((i) => `${i.item_name}(${i.outbound_qty})`)
      .join('、') || '尚無資料'
  const periodHint =
    summary?.profit_period_start && summary?.profit_period_end
      ? `${summary.profit_period_start} ~ ${summary.profit_period_end}`
      : '本月'

  return (
    <div className="panel">
      <h2 className="page-title">今日總覽</h2>

      <div className="section-title">即將到來的提醒</div>
      {upcoming.length === 0 ? (
        <div className="empty-state">尚無提醒</div>
      ) : (
        upcoming.map((r) => (
          <article
            key={r.id}
            className="card card-clickable"
            onClick={() => onNavigate('reminders')}
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

      {countdown ? (
        <button
          type="button"
          className="countdown-card"
          onClick={() => openExternal(countdown.deep_link)}
          disabled={!countdown.deep_link}
        >
          <div className="countdown-badge">{countdown.days_label}</div>
          <div className="countdown-body">
            <div className="countdown-title">{countdown.title}</div>
            <div className="countdown-sub">
              {countdown.due_date}
              {countdown.subtitle ? ` · ${countdown.subtitle}` : ''}
            </div>
          </div>
          {countdown.deep_link ? <span className="ql-arrow" aria-hidden>›</span> : null}
        </button>
      ) : null}

      <div className="quick-grid">
        <button type="button" className="quick-link" onClick={() => onNavigate('reminders')}>
          <span className="ql-icon">🔔</span>
          <span className="ql-body">
            未讀提醒
            <span className="ql-sub">{summary?.unread_total ?? 0} 則 · 全部提醒</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => onNavigate('ideas')}>
          <span className="ql-icon">💡</span>
          <span className="ql-body">
            待決策
            <span className="ql-sub">{summary?.pending_ideas ?? 0} 則 · 想法</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => onNavigate('profit')}>
          <span className="ql-icon">💰</span>
          <span className="ql-body">
            本月毛利
            <span className="ql-sub">
              {money(summary?.profit_month_total ?? 0)} · 日均 {money(summary?.profit_daily_average ?? 0)} · {periodHint}
            </span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => onNavigate('shipping')}>
          <span className="ql-icon">📦</span>
          <span className="ql-body">
            運輸中
            <span className="ql-sub">{summary?.shipping_in_transit ?? 0} 筆 · 單號追蹤</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <div className="quick-link quick-link--static">
          <span className="ql-icon">🔥</span>
          <span className="ql-body">
            本月熱銷款
            <span className="ql-sub">{hotPreview}</span>
          </span>
        </div>
        <button type="button" className="quick-link" onClick={() => onNavigate('body')}>
          <span className="ql-icon">💪</span>
          <span className="ql-body">
            身體紀錄
            <span className="ql-sub">訓練與體重</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => onNavigate('inventory')}>
          <span className="ql-icon">📋</span>
          <span className="ql-body">
            庫存草稿
            <span className="ql-sub">確認 OCR 入庫</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={onOpenInput}>
          <span className="ql-icon">📷</span>
          <span className="ql-body">
            入庫截圖
            <span className="ql-sub">貼上淘寶採購截圖建立草稿</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
      </div>
    </div>
  )
}
