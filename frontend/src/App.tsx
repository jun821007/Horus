import { useState } from 'react'
import { BodyPanel } from './components/BodyPanel'
import { HomeDashboard } from './components/HomeDashboard'
import { IdeasPanel } from './components/IdeasPanel'
import { InputSheet } from './components/InputSheet'
import { InventoryDrafts } from './components/InventoryDrafts'
import { LycheePanel } from './components/LycheePanel'
import { ProfitDashboard } from './components/ProfitDashboard'
import { RemindersPanel } from './components/RemindersPanel'
import { ShippingPanel } from './components/ShippingPanel'
import { Toast } from './components/Toast'
import type { AppPage } from './types/app'

const PAGE_TITLES: Record<AppPage, string> = {
  home: 'Horus',
  shipping: '單號追蹤',
  reminders: '提醒',
  ideas: '想法',
  body: '身體',
  inventory: '庫存草稿',
  lychee: '荔枝出貨',
  profit: '毛利',
}

export default function App() {
  const [page, setPage] = useState<AppPage>('home')
  const [inputOpen, setInputOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null)

  const bump = () => setRefreshKey((k) => k + 1)
  const showMsg = (text: string, err?: boolean) => {
    setToast({ text, err })
    window.setTimeout(() => setToast(null), 3500)
  }
  const goHome = () => setPage('home')

  return (
    <div className="app-shell">
      <header className="app-header">
        {page !== 'home' ? (
          <button type="button" className="header-back" onClick={goHome} aria-label="返回">‹</button>
        ) : (
          <img src="/icon.png" alt="" width={32} height={32} />
        )}
        <div>
          <h1>{PAGE_TITLES[page]}</h1>
        </div>
      </header>

      <main className="app-main">
        {page === 'home' ? (
          <HomeDashboard
            refreshKey={refreshKey}
            onNavigate={setPage}
            onOpenInput={() => setInputOpen(true)}
          />
        ) : null}
        {page === 'shipping' ? <ShippingPanel refreshKey={refreshKey} /> : null}
        {page === 'reminders' ? <RemindersPanel refreshKey={refreshKey} /> : null}
        {page === 'ideas' ? <IdeasPanel onMessage={showMsg} /> : null}
        {page === 'body' ? <BodyPanel onMessage={showMsg} /> : null}
        {page === 'inventory' ? (
          <InventoryDrafts refreshKey={refreshKey} onMessage={showMsg} onConfirmed={bump} />
        ) : null}
        {page === 'lychee' ? <LycheePanel refreshKey={refreshKey} onMessage={showMsg} /> : null}
        {page === 'profit' ? <ProfitDashboard refreshKey={refreshKey} onMessage={showMsg} /> : null}
      </main>

      <InputSheet
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        onResult={showMsg}
        onSuccess={() => {
          bump()
          setInputOpen(false)
          setPage('inventory')
        }}
      />

      <Toast message={toast?.text ?? null} err={toast?.err} />
    </div>
  )
}
