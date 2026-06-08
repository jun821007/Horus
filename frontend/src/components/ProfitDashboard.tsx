import { useCallback, useEffect, useState } from 'react'
import { apiDelete, apiGet, apiPost } from '../lib/api'

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

type Summary = {
  ok: boolean
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
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`
}

export function ProfitDashboard({ refreshKey, onMessage }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [itemName, setItemName] = useState('')
  const [netProfit, setNetProfit] = useState('')
  const [profitDate, setProfitDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const load = useCallback(async () => {
    const data = await apiGet<Summary>('/api/profits/summary').catch(() => null)
    setSummary(data)
    if (data && !profitDate) setProfitDate(data.period_end)
    if (data?.categories?.length && !categoryId) setCategoryId(data.categories[0].id)
  }, [categoryId, profitDate])

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
    : '本月'

  return (
    <div className="panel">
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
    </div>
  )
}
