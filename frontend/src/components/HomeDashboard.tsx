import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../lib/api'
import type { AppTab, SubPage } from '../types/app'

type DashboardSummary = {
  ok: boolean
  lychee_tomorrow: { count: number; ship_date: string; preview: string[]; deep_link: string | null }
  hot_sellers: {
    period_days: number
    items: Array<{ category: string; item_name: string; outbound_qty: number; rank: number }>
    deep_link: string | null
  }
  shipping_in_transit: number
  unread_arrivals: number
  unread_total: number
}

type Props = {
  refreshKey: number
  onNavigateTab: (tab: AppTab) => void
  onOpenSub: (page: SubPage) => void
}

function openExternal(url: string | null | undefined) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function HomeDashboard({ refreshKey, onNavigateTab, onOpenSub }: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)

  const load = useCallback(async () => {
    const data = await apiGet<DashboardSummary>('/api/dashboard/summary').catch(() => null)
    setSummary(data)
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  const hotPreview = summary?.hot_sellers.items?.slice(0, 3).map((i) => `${i.item_name}(${i.outbound_qty})`).join('、') || '尚無資料'

  return (
    <div className="panel">
      <h2 className="page-title">今日總覽</h2>

      <div className="section-title">整合提醒</div>
      <div className="quick-grid">
        <button type="button" className="quick-link" onClick={() => openExternal(summary?.lychee_tomorrow.deep_link)}>
          <span className="ql-icon">🍒</span>
          <span className="ql-body">
            明日荔枝
            <span className="ql-sub">
              {summary ? (summary.lychee_tomorrow.count > 0 ? `明天 ${summary.lychee_tomorrow.count} 筆` : '無出貨') : '載入中…'}
            </span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => openExternal(summary?.hot_sellers.deep_link)}>
          <span className="ql-icon">🔥</span>
          <span className="ql-body">
            本週熱銷
            <span className="ql-sub">{hotPreview}</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
        <button type="button" className="quick-link" onClick={() => onNavigateTab('reminders')}>
          <span className="ql-icon">📦</span>
          <span className="ql-body">
            到貨待領
            <span className="ql-sub">{summary ? `${summary.unread_arrivals} 則未讀` : '載入中…'}</span>
          </span>
          <span className="ql-arrow">›</span>
        </button>
      </div>

      <div className="stat-grid">
        <button type="button" className="stat-card" onClick={() => onNavigateTab('shipping')}>
          <div className="stat-label">運輸中</div>
          <div className="stat-value">{summary?.shipping_in_transit ?? 0}</div>
          <div className="stat-hint">自動追蹤</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigateTab('reminders')}>
          <div className="stat-label">未讀提醒</div>
          <div className="stat-value">{summary?.unread_total ?? 0}</div>
          <div className="stat-hint">含荔枝/熱銷/到貨</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onNavigateTab('ideas')}>
          <div className="stat-label">想法</div>
          <div className="stat-value gold">→</div>
          <div className="stat-hint">待決策清單</div>
        </button>
        <button type="button" className="stat-card" onClick={() => onOpenSub('profit')}>
          <div className="stat-label">毛利</div>
          <div className="stat-value gold">POS</div>
          <div className="stat-hint">快速記帳</div>
        </button>
      </div>

      <div className="section-title">更多</div>
      <div className="quick-grid">
        <button type="button" className="quick-link" onClick={() => onOpenSub('inventory')}>
          <span className="ql-icon">📋</span>
          <span className="ql-body">庫存草稿<span className="ql-sub">淘寶 OCR 入庫</span></span>
          <span className="ql-arrow">›</span>
        </button>
      </div>
    </div>
  )
}
