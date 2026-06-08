import type { AppTab } from '../types/app'

const TABS: Array<{ id: AppTab; label: string; icon: string }> = [
  { id: 'home', label: '首頁', icon: '🏠' },
  { id: 'shipping', label: '單號', icon: '📦' },
  { id: 'reminders', label: '提醒', icon: '🔔' },
  { id: 'ideas', label: '想法', icon: '💡' },
  { id: 'body', label: '身體', icon: '💪' },
]

type Props = {
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav" aria-label="主導航">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={active === t.id ? 'bottom-nav-item active' : 'bottom-nav-item'}
          onClick={() => onChange(t.id)}
        >
          <span className="nav-icon" aria-hidden>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
