import { useCallback, useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../lib/api'
import { shiftYearMonth, taipeiCurrentYearMonth } from '../lib/taipei-month'

type Category = { id: string; name: string }
type CategoryTotal = { category_id: string | null; category_name: string; total: number }
type Adjustment = {
  id: string
  item_name: string
  net_profit: number
  profit_date: string
  note: string | null
  category_id: string | null
  profit_categories?: { name?: string } | null
}
type DayItem = { name: string; profit: number; source: 'pos' | 'custom' }
type DayBreakdown = { date: string; total: number; item_count: number; items: DayItem[] }
type MonthHistory = {
  year_month: string
  period_start: string
  period_end: string
  month_total: number
  pos_profit: number
  custom_profit: number
}

type Summary = {
  ok: boolean
  year_month: string
  is_current_month: boolean
  period_start: string
  period_end: string
  day_of_month: number
  pos_profit: number
  custom_profit: number
  month_total: number
  daily_average: number
  pos_source: 'pos' | 'skipped'
  custom_by_category: CategoryTotal[]
  adjustments: Adjustment[]
  categories: Category[]
  daily_breakdown: DayBreakdown[]
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

export function ProfitDashboard({ refreshKey, onMessage }: Props) {
  const [month, setMonth] = useState(taipeiCurrentYearMonth())
  const [summary, setSummary] = useState<Summary | null>(null)
  const [history, setHistory] = useState<MonthHistory[]>([])
  const [itemName, setItemName] = useState('')
  const [netProfit, setNetProfit] = useState('')
  const [profitDate, setProfitDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const load = useCallback(async () => {
    const [data, hist] = await Promise.all([
      apiGet<Summary>(`/api/profits/summary?month=${encodeURIComponent(month)}`).catch(() => null),
      apiGet<{ items: MonthHistory[] }>('/api/profits/history?months=12').catch(() => ({ items: [] })),
    ])
    setSummary(data)
    setHistory(hist.items)
    if (data && !profitDate) setProfitDate(data.period_end)
    if (data?.categories?.length && !categoryId) setCategoryId(data.categories[0].id)
  }, [month, categoryId, profitDate])

  useEffect(() => { void load() }, [load, refreshKey])

  const addCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    try {
      await apiPost('/api/profits/categories', { name })
      setNewCategory('')
      onMessage(`已新增分類：${name}`)
      void load()
    } catch (err) {
      onMessage(String(err), true)
    }
  }

  const addAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    const profit = Number(netProfit)
    if (!itemName.trim() || !Number.isFinite(profit)) {
      onMessage('請填寫品項與毛利金額', true)
      return
    }
    try {
      await apiPost('/api/profits/adjustments', {
        item_name: itemName.trim(),
        net_profit: profit,
        profit_date: profitDate || summary?.period_end,
        category_id: categoryId || null,
      })
      onMessage(`已新增自定義收益 +${Math.round(profit)} 元`)
      setItemName('')
      setNetProfit('')
      void load()
    } catch (err) {
      onMessage(String(err), true)
    }
  }

  const removeAdjustment = async (id: string) => {
    try {
      await apiDelete(`/api/profits/adjustments/${id}`)
      onMessage('已刪除')
      void load()
    } catch (err) {
      onMessage(String(err), true)
    }
  }

  const periodLabel = summary
    ? `${summary.period_start} ~ ${summary.period_end}`
    : month

  const canEdit = summary?.is_current_month ?? month === taipeiCurrentYearMonth()

  return (
    <div className="panel">
      <div className="month-nav">
        <button type="button" className="month-nav-btn" onClick={() => setMonth((m) => shiftYearMonth(m, -1))} aria-label="上個月">‹</button>
        <div className="month-nav-label">{month}</div>
        <button
          type="button"
          className="month-nav-btn"
          onClick={() => setMonth((m) => shiftYearMonth(m, 1))}
          disabled={month >= taipeiCurrentYearMonth()}
          aria-label="下個月"
        >
          ›
        </button>
      </div>

      <div className="section-title">{periodLabel} 毛利</div>
      <div className="stat-grid">
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-label">本月合計</div>
          <div className="stat-value gold">{money(summary?.month_total ?? 0)}</div>
        </div>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-label">日均收益</div>
          <div className="stat-value">{money(summary?.daily_average ?? 0)}</div>
          <div className="stat-hint">÷ {summary?.day_of_month ?? '-'}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <h3 className="card-title">POS 收益</h3>
          <span className="chip muted">{summary?.pos_source === 'skipped' ? '未設定 POS' : 'POS 同步'}</span>
        </div>
        <div className="stat-value" style={{ fontSize: 24 }}>{money(summary?.pos_profit ?? 0)}</div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <h3 className="card-title">自定義收益</h3>
          <span className="chip">{money(summary?.custom_profit ?? 0)}</span>
        </div>
        {(summary?.custom_by_category ?? []).length === 0 ? (
          <p className="card-meta">尚無自定義收益</p>
        ) : (
          (summary?.custom_by_category ?? []).map((row) => (
            <div key={row.category_id ?? 'none'} className="card-meta" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{row.category_name}</span>
              <strong>{money(row.total)}</strong>
            </div>
          ))
        )}
      </div>

      <div className="section-title" style={{ marginTop: 16 }}>每日明細</div>
      {(summary?.daily_breakdown ?? []).length === 0 ? (
        <div className="empty-state">本月尚無收益紀錄</div>
      ) : (
        (summary?.daily_breakdown ?? []).map((day) => (
          <article key={day.date} className="card">
            <div className="card-header">
              <h3 className="card-title">{day.date}</h3>
              <span className="chip success">{money(day.total)} · {day.item_count} 樣</span>
            </div>
            {day.items.map((item, idx) => (
              <div key={`${day.date}-${idx}`} className="card-meta" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{item.name}{item.source === 'custom' ? ' · 自定義' : ''}</span>
                <strong>{money(item.profit)}</strong>
              </div>
            ))}
          </article>
        ))
      )}

      <div className="section-title" style={{ marginTop: 16 }}>歷史摘要（12 個月）</div>
      {history.length === 0 ? (
        <div className="empty-state">尚無歷史資料</div>
      ) : (
        <div className="quick-grid">
          {history.map((row) => (
            <button
              key={row.year_month}
              type="button"
              className={`quick-link ${row.year_month === month ? 'quick-link--active' : ''}`}
              onClick={() => setMonth(row.year_month)}
            >
              <span className="ql-body">
                {row.year_month}
                <span className="ql-sub">
                  {money(row.month_total)} · POS {money(row.pos_profit)} · 自定義 {money(row.custom_profit)}
                </span>
              </span>
              <span className="ql-arrow">›</span>
            </button>
          ))}
        </div>
      )}

      {canEdit ? (
        <>
          <div className="section-title" style={{ marginTop: 16 }}>新增自定義收益</div>
          <form className="inline-form card" onSubmit={(e) => void addAdjustment(e)}>
            <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="品項名稱" />
            <input value={netProfit} onChange={(e) => setNetProfit(e.target.value)} placeholder="毛利金額 TWD" inputMode="decimal" />
            <input type="date" value={profitDate} onChange={(e) => setProfitDate(e.target.value)} />
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {(summary?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary">新增收益</button>
          </form>

          <div className="inline-form card" style={{ marginTop: 8 }}>
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新分類名稱" />
            <button type="button" className="btn" onClick={() => void addCategory()}>新增分類</button>
          </div>

          <div className="section-title" style={{ marginTop: 16 }}>本月自定義明細</div>
          {(summary?.adjustments ?? []).length === 0 ? (
            <div className="empty-state">尚無明細</div>
          ) : (
            (summary?.adjustments ?? []).map((row) => (
              <article key={row.id} className="card">
                <div className="card-header">
                  <h3 className="card-title">{row.item_name}</h3>
                  <span className="chip success">+{money(Number(row.net_profit))}</span>
                </div>
                <p className="card-meta">
                  {row.profit_date} · {row.profit_categories?.name ?? '未分類'}
                </p>
                <button type="button" className="btn btn-ghost" onClick={() => void removeAdjustment(row.id)}>刪除</button>
              </article>
            ))
          )}
        </>
      ) : null}
    </div>
  )
}
