import { useEffect, useState } from 'react'
import { ArrivalAlertModal } from './components/ArrivalAlertModal'
import { BodyPanel } from './components/BodyPanel'
import { HomeDashboard } from './components/HomeDashboard'
import { IdeasPanel } from './components/IdeasPanel'
import { LoginScreen } from './components/LoginScreen'
import { LycheePanel } from './components/LycheePanel'
import { ProfitDashboard } from './components/ProfitDashboard'
import { RemindersPanel } from './components/RemindersPanel'
import { ShippingPanel } from './components/ShippingPanel'
import { TaobaoInventoryPanel } from './components/TaobaoInventoryPanel'
import { Toast } from './components/Toast'
import { fetchSession, logoutRequest } from './lib/api'
import type { AppPage } from './types/app'

export default function App() {
  const [authState, setAuthState] = useState<'loading' | 'guest' | 'authed'>('loading')
  const [username, setUsername] = useState('')
  const [page, setPage] = useState<AppPage>('home')
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<{ text: string; err?: boolean } | null>(null)

  const bump = () => setRefreshKey((k) => k + 1)
  const showMsg = (text: string, err?: boolean) => {
    setToast({ text, err })
    window.setTimeout(() => setToast(null), 3500)
  }
  const goHome = () => setPage('home')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const s = await fetchSession()
        if (cancelled) return
        if (s.authenticated) {
          setUsername(s.username || '')
          setAuthState('authed')
        } else {
          setAuthState('guest')
        }
      } catch {
        if (!cancelled) setAuthState('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onLoggedIn = (name: string) => {
    setUsername(name)
    setAuthState('authed')
    setPage('home')
    bump()
  }

  const onLogout = async () => {
    await logoutRequest().catch(() => undefined)
    setUsername('')
    setAuthState('guest')
    setPage('home')
  }

  if (authState === 'loading') {
    return (
      <div className="app-shell">
        <div className="empty-state">載入中…</div>
      </div>
    )
  }

  if (authState === 'guest') {
    return (
      <div className="app-shell">
        <LoginScreen onLoggedIn={onLoggedIn} />
        <Toast message={toast?.text ?? null} err={toast?.err} />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {page !== 'home' ? (
        <button type="button" className="floating-back" onClick={goHome} aria-label="返回">
          ‹
        </button>
      ) : null}

      <main className="app-main">
        {page === 'home' ? (
          <HomeDashboard
            refreshKey={refreshKey}
            onNavigate={setPage}
            username={username}
            onLogout={() => void onLogout()}
          />
        ) : null}
        {page === 'shipping' ? <ShippingPanel refreshKey={refreshKey} /> : null}
        {page === 'reminders' ? <RemindersPanel refreshKey={refreshKey} /> : null}
        {page === 'ideas' ? <IdeasPanel onMessage={showMsg} /> : null}
        {page === 'body' ? <BodyPanel onMessage={showMsg} /> : null}
        {page === 'inventory' ? (
          <TaobaoInventoryPanel refreshKey={refreshKey} onMessage={showMsg} onConfirmed={bump} />
        ) : null}
        {page === 'lychee' ? <LycheePanel refreshKey={refreshKey} onMessage={showMsg} /> : null}
        {page === 'profit' ? <ProfitDashboard refreshKey={refreshKey} onMessage={showMsg} /> : null}
      </main>

      <Toast message={toast?.text ?? null} err={toast?.err} />
      <ArrivalAlertModal refreshKey={refreshKey} onAcknowledged={bump} />
    </div>
  )
}
