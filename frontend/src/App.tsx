import { useState } from 'react'
import { UniversalInput } from './components/UniversalInput'
import { ShippingPanel } from './components/ShippingPanel'
import { InventoryDrafts } from './components/InventoryDrafts'
import { RemindersPanel } from './components/RemindersPanel'
import { LycheePanel } from './components/LycheePanel'
import { ProfitDashboard } from './components/ProfitDashboard'
import { IdeasPanel } from './components/IdeasPanel'

type Module = 'shipping' | 'inventory' | 'reminders' | 'lychee' | 'profit' | 'ideas'

const TABS: Array<{ id: Module; label: string }> = [
  { id: 'shipping', label: '單號' },
  { id: 'inventory', label: '庫存' },
  { id: 'reminders', label: '提醒' },
  { id: 'lychee', label: '荔枝' },
  { id: 'profit', label: '毛利' },
  { id: 'ideas', label: '想法' },
]

export default function App() {
  const [module, setModule] = useState<Module>('shipping')
  const [refreshKey, setRefreshKey] = useState(0)
  const [flash, setFlash] = useState<{ text: string; err?: boolean } | null>(null)

  const bump = () => setRefreshKey((k) => k + 1)
  const showMsg = (text: string, err?: boolean) => {
    setFlash({ text, err })
    window.setTimeout(() => setFlash(null), 4000)
  }

  return (
    <div className={`app ${module === 'ideas' ? 'app--ideas' : ''}`}>
      {flash ? <div className={flash.err ? 'flash err' : 'flash'}>{flash.text}</div> : null}

      {module !== 'ideas' ? (
        <UniversalInput
          onResult={showMsg}
          onSuccess={() => {
            bump()
            setModule('inventory')
          }}
        />
      ) : null}

      <nav className="module-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={module === t.id ? 'tab active' : 'tab'}
            onClick={() => setModule(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {module === 'shipping' ? <ShippingPanel refreshKey={refreshKey} /> : null}
      {module === 'inventory' ? (
        <InventoryDrafts refreshKey={refreshKey} onMessage={showMsg} onConfirmed={bump} />
      ) : null}
      {module === 'reminders' ? <RemindersPanel refreshKey={refreshKey} /> : null}
      {module === 'lychee' ? <LycheePanel refreshKey={refreshKey} onMessage={showMsg} /> : null}
      {module === 'profit' ? <ProfitDashboard refreshKey={refreshKey} onMessage={showMsg} /> : null}
      {module === 'ideas' ? <IdeasPanel onMessage={showMsg} /> : null}
    </div>
  )
}
