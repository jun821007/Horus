import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, ingestInput } from '../lib/api'

type Draft = {
  id: string
  item_name: string
  quantity: number
  rmb_amount: number | null
  twd_amount: number
  exchange_rate: number | null
  unit_cost_twd: number
  created_at: string
}

type Props = {
  refreshKey: number
  onMessage: (msg: string, err?: boolean) => void
  onConfirmed: () => void
}

export function TaobaoInventoryPanel({ refreshKey, onMessage, onConfirmed }: Props) {
  const [items, setItems] = useState<Draft[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    void apiGet<{ items: Draft[] }>('/api/inventory-drafts').then((d) => setItems(d.items)).catch(() => setItems([]))
  }, [])

  useEffect(() => { load() }, [load, refreshKey])

  const setImage = useCallback((f: File | null) => {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }, [preview])

  const submit = async () => {
    if (!file) {
      onMessage('請貼上淘寶採購截圖（必填）', true)
      return
    }
    setBusy(true)
    try {
      const res = await ingestInput(text, file)
      onMessage(res.message ?? '已建立入庫草稿')
      setText('')
      setImage(null)
      load()
      onConfirmed()
    } catch (e) {
      onMessage(e instanceof Error ? e.message : String(e), true)
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (id: string) => {
    setBusyId(id)
    try {
      const res = await apiPost<{ ok: boolean; item_name: string; quantity_added: number }>(
        `/api/inventory-drafts/${id}/confirm`,
      )
      onMessage(`已入庫 ${res.item_name} +${res.quantity_added}`)
      onConfirmed()
      load()
    } catch (e) {
      onMessage(String(e), true)
    } finally {
      setBusyId(null)
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const clipItems = e.clipboardData?.items
    if (!clipItems) return
    for (const item of clipItems) {
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) {
          setImage(f)
          e.preventDefault()
        }
        break
      }
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f?.type.startsWith('image/')) setImage(f)
  }

  return (
    <div className="panel">
      <div className="section-title">貼上淘寶截圖</div>
      <div className="card">
        <textarea
          className="input-field"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          placeholder="貼上淘寶採購截圖，建立入庫草稿"
        />
        <div
          className={drag ? 'drop-zone dragover' : 'drop-zone'}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          {preview ? (
            <img className="preview" src={preview} alt="預覽" />
          ) : (
            <span>點擊選圖 · 拖放 · 貼上截圖</span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="card-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void submit()}>
            {busy ? '分析中…' : '送出'}
          </button>
          {file ? (
            <button type="button" className="btn btn-sm" onClick={() => setImage(null)}>清除圖片</button>
          ) : null}
        </div>
      </div>

      <div className="section-title">待確認草稿</div>
      {items.length === 0 ? (
        <div className="empty-state">無待確認草稿</div>
      ) : (
        items.map((d) => (
          <article key={d.id} className="card">
            <h3 className="card-title">{d.item_name} × {d.quantity}</h3>
            <p className="card-meta">
              RMB {d.rmb_amount ?? '—'} / TWD {d.twd_amount}<br />
              匯率 {Number(d.exchange_rate ?? 0).toFixed(2)} · 單件 {Number(d.unit_cost_twd).toFixed(2)} 元
            </p>
            <div className="card-actions">
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={busyId === d.id}
                onClick={() => void confirm(d.id)}
              >
                {busyId === d.id ? '處理中…' : '確認入庫'}
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  )
}
