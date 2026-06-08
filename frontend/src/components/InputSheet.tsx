import { useCallback, useRef, useState } from 'react'
import { ingestInput } from '../lib/api'

type Props = {
  open: boolean
  onClose: () => void
  onResult: (msg: string, isError?: boolean) => void
  onSuccess: () => void
}

export function InputSheet({ open, onClose, onResult, onSuccess }: Props) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const setImage = useCallback((f: File | null) => {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }, [preview])

  const reset = () => {
    setText('')
    setImage(null)
  }

  const submit = async () => {
    if (!text.trim() && !file) {
      onResult('請輸入文字或貼上採購截圖', true)
      return
    }
    setBusy(true)
    try {
      const res = await ingestInput(text, file ?? undefined)
      onResult(res.message ?? '已處理')
      reset()
      onSuccess()
      onClose()
    } catch (e) {
      onResult(e instanceof Error ? e.message : String(e), true)
    } finally {
      setBusy(false)
    }
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
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

  if (!open) return null

  return (
    <>
      <div className="sheet-overlay" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-label="全域輸入">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>快速輸入</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <div className="sheet-body">
          <textarea
            className="input-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={onPaste}
            placeholder="單號＋內容物，或貼上淘寶採購截圖說明"
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
      </div>
    </>
  )
}
