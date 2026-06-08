import { useState } from 'react'
import { apiPost } from '../lib/api'

type Props = {
  onMessage: (text: string, err?: boolean) => void
  onCaptured: () => void
}

export function IdeaCaptureView({ onMessage, onCaptured }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      await apiPost('/api/ideas', { text })
      setDraft('')
      onCaptured()
      onMessage('已記錄，分析完成後會出現在待決策')
    } catch (e) {
      onMessage(String(e), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ideas-capture">
      <p className="page-desc">隨手記下靈感，有空再到「待決策」查看分類與方案。</p>
      <textarea
        className="input-field"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="突然想到什麼？"
        rows={4}
        disabled={busy}
      />
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 8 }}
        disabled={busy || !draft.trim()}
        onClick={() => void submit()}
      >
        {busy ? '記錄中…' : '記錄靈感'}
      </button>
    </div>
  )
}
