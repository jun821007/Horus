import { useState } from 'react'
import { BodyPanel } from './components/BodyPanel'
import { BottomNav } from './components/BottomNav'
import { HomeDashboard } from './components/HomeDashboard'
import { IdeasPanel } from './components/IdeasPanel'
import { InputSheet } from './components/InputSheet'
import { InventoryDrafts } from './components/InventoryDrafts'
import { LycheePanel } from './components/LycheePanel'
import { ProfitDashboard } from './components/ProfitDashboard'
import { RemindersPanel } from './components/RemindersPanel'
import { ShippingPanel } from './components/ShippingPanel'
import { Toast } from './components/Toast'
import type { AppTab, SubPage } from './types/app'

const SUB_TITLES: Record<NonNullable<SubPage>, string> = {
  inventory: '庫存草稿',
  lychee: '荔枝出貨',
  profit: '毛利結帳',
}

const TAB_TITLES: Record<AppTab, string> = {
  home: 'Horus',
  shipping: '單號',
  reminders: '提醒',
  ideas: '想法',
  body: '身體',
}

export default function App() {
  const [tab, setTab] = useState<AppTab>('home')
  const [subPage, setSubPage] = useState<SubPage>(null)
  const [inputOpen, setInputOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null)

  const bump = () => setRefreshKey((k) => k + 1)
  const showMsg = (text: string, err?: boolean) => {
    setToast({ text, err })
    window.setTimeout(() => setToast(null), 3500)
  }

  const showFab = tab !== 'ideas'
  const headerTitle = subPage ? SUB_TITLES[subPage] : TAB_TITLES[tab]

  return (
    <div className="app-shell">
      <header className="app-header">
        {subPage ? (
          <button type="button" className="header-back" onClick={() => setSubPage(null)} aria-label="返回">‹</button>
        ) : (
          <img src="/icon.png" alt="" width={32} height={32} />
        )}
        <div>
          <h1>{headerTitle}</h1>
        </div>
      </header>

      <main className={showFab ? 'app-main' : 'app-main app-main--no-fab'}>
        {subPage === 'inventory' ? (
          <InventoryDrafts refreshKey={refreshKey} onMessage={showMsg} onConfirmed={bump} />
        ) : null}
        {subPage === 'lychee' ? <LycheePanel refreshKey={refreshKey} onMessage={showMsg} /> : null}
        {subPage === 'profit' ? <ProfitDashboard refreshKey={refreshKey} onMessage={showMsg} /> : null}

        {!subPage && tab === 'home' ? (
          <HomeDashboard refreshKey={refreshKey} onNavigateTab={setTab} onOpenSub={setSubPage} />
        ) : null}
        {!subPage && tab === 'shipping' ? <ShippingPanel refreshKey={refreshKey} /> : null}
        {!subPage && tab === 'reminders' ? <RemindersPanel refreshKey={refreshKey} /> : null}
        {!subPage && tab === 'ideas' ? <IdeasPanel onMessage={showMsg} /> : null}
        {!subPage && tab === 'body' ? <BodyPanel onMessage={showMsg} /> : null}
      </main>

      {showFab ? (
        <button type="button" className="fab" onClick={() => setInputOpen(true)} aria-label="快速輸入">+</button>
      ) : null}

      <InputSheet
        open={inputOpen}
        onClose={() => setInputOpen(false)}
        onResult={showMsg}
        onSuccess={() => {
          bump()
          if (tab === 'home') setSubPage('inventory')
        }}
      />

      <BottomNav
        active={subPage ? 'home' : tab}
        onChange={(t) => {
          setSubPage(null)
          setTab(t)
        }}
      />

      <Toast message={toast?.text ?? null} err={toast?.err} />
    </div>
  )
}
