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
  target_ship_date?: string | null
  metadata?: { deep_link?: string } | null
}

type CountdownItem = {
  title: string
  body: string
  kind: string
  target_ship_date: string
  days_until: number
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

function countdownLabel(days: number): string {
  if (days <= 0) return '就是今天'
  if (days === 1) return '明天'
  return `還有 ${days} 天`
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

      {countdown ? (
        <button type="button" className="countdown-card" onClick={() => onNavigate('reminders')}>
          <div className="countdown-badge">
            {countdown.days_until <= 0 ? 'D-Day' : `D-${countdown.days_until}`}
          </div>
          <div className="countdown-body">
            <div className="countdown-title">{countdown.title}</div>
            <div className="countdown-sub">
              {countdownLabel(countdown.days_until)} · {countdown.target_ship_date}
            </div>
            {countdown.body ? <div className="countdown-meta">{countdown.body}</div> : null}
          </div>
          <span className="ql-arrow" aria-hidden>›</span>
        </button>
      ) : null}

      <div className="section-title">快捷功能</div>
      <div className="quick-grid">
        <button type="button" className="quick-link" onClick={onOpenInput}>
          <span className="ql-icon">📷</span>
          <span className="ql-body">
            入庫截圖
            <span className="ql-sub">貼上淘寶採購截圖建立草稿</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button
          type="button"
          className="quick-link"
          onClick={() => openExternal(summary?.hot_sellers.deep_link)}
        >
          <span className="ql-icon">🔥</span>
          <span className="ql-body">
            本月熱銷款
            <span className="ql-sub">{hotPreview}</span>
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
        <button type="button" className="quick-link" onClick={() => onNavigate('body')}>
          <span className="ql-icon">💪</span>
          <span className="ql-body">
            身體紀錄
            <span className="ql-sub">訓練與體重</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
      </div>

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
            {r.target_ship_date ? (
              <p className="card-meta">{countdownLabel(daysUntil(r.target_ship_date))} · {r.target_ship_date}</p>
            ) : null}
          </article>
        ))
      )}

      <div className="stat-grid" style={{ marginTop: 16 }}>
        <button type="button" className="stat-card" onClick={() => onNavigate('shipping')}>
          <div className="stat-label">運輸中</div>
          <div className="stat-value">{summary?.shipping_in_transit ?? 0}</div>
          <div className="stat-hint">單號追蹤</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigate('reminders')}>
          <div className="stat-label">未讀提醒</div>
          <div className="stat-value">{summary?.unread_total ?? 0}</div>
          <div className="stat-hint">全部提醒</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigate('ideas')}>
          <div className="stat-label">待決策</div>
          <div className="stat-value gold">{summary?.pending_ideas ?? 0}</div>
          <div className="stat-hint">想法</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigate('profit')}>
          <div className="stat-label">本月毛利</div>
          <div className="stat-value gold">{money(summary?.profit_month_total ?? 0)}</div>
          <div className="stat-hint">日均 {money(summary?.profit_daily_average ?? 0)} · {periodHint}</div>
        </button>
      </div>
    </div>
  )
}

function daysUntil(targetYmd: string): number {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const a = new Date(`${today}T12:00:00+08:00`).getTime()
  const b = new Date(`${targetYmd}T12:00:00+08:00`).getTime()
  return Math.round((b - a) / 86400000)
}
