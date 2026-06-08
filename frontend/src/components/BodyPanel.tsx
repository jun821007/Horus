import { useEffect, useState } from 'react'

const CHECKS = [
  { id: 'water', label: '喝水 2000ml' },
  { id: 'stretch', label: '伸展 10 分鐘' },
  { id: 'walk', label: '走動 5000 步' },
  { id: 'sleep', label: '昨晚睡滿 7 小時' },
] as const

const STORAGE_KEY = 'horus-body-checks'

type Props = {
  onMessage: (text: string, err?: boolean) => void
}

export function BodyPanel({ onMessage }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>)
    } catch { /* ignore */ }
  }, [])

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const done = Object.values(checked).filter(Boolean).length

  return (
    <div className="panel">
      <h2 className="page-title">身體</h2>
      <p className="page-desc">今日自我照顧 · {done}/{CHECKS.length} 完成</p>

      <div className="stat-grid" style={{ gridTemplateColumns: '1fr' }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <div className="stat-label">今日完成度</div>
          <div className="stat-value gold">{Math.round((done / CHECKS.length) * 100)}%</div>
          <div className="stat-hint">資料僅存於本機</div>
        </div>
      </div>

      <div className="section-title">每日檢查</div>
      <div className="body-check-grid">
        {CHECKS.map((c) => (
          <div key={c.id} className="body-check-item">
            <input
              id={`body-${c.id}`}
              type="checkbox"
              checked={Boolean(checked[c.id])}
              onChange={() => toggle(c.id)}
            />
            <label htmlFor={`body-${c.id}`}>{c.label}</label>
          </div>
        ))}
      </div>

      <div className="section-title">備註</div>
      <div className="card">
        <p className="card-meta" style={{ margin: 0 }}>
          身體模組 P0：本機打卡。之後可串接健康類想法、穿戴裝置或提醒。
        </p>
        <div className="card-actions">
          <button type="button" className="btn btn-sm" onClick={() => onMessage('身體紀錄已儲存於本機')}>
            儲存確認
          </button>
        </div>
      </div>
    </div>
  )
}
