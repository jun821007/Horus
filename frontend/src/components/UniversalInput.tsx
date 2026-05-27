import { useCallback, useRef, useState } from 'react'
import { ingestInput } from '../lib/api'

type Props = {
  onResult: (msg: string, isError?: boolean) => void
  onSuccess: () => void
}

export function UniversalInput({ onResult, onSuccess }: Props) {
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

  const submit = async () => {
    if (!text.trim() && !file) {
      onResult('請輸入文字或貼上採購截圖', true)
      return
    }
    setBusy(true)
    try {
      const res = await ingestInput(text, file ?? undefined)
      onResult(res.message ?? '已處理')
      setText('')
      setImage(null)
      onSuccess()
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

  return (
    <section className="pixel-panel universal-input">
      <h2>全域輸入</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={onPaste}
        placeholder="單號＋內容物，例：8531039226 / 氣泡袋、戒指&#10;或貼上淘寶採購截圖（拖放至此區）"
      />
      <div
        className={drag ? 'drop-zone dragover' : 'drop-zone'}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        {preview ? (
          <img className="preview" src={preview} alt="預覽" />
        ) : (
          <span>拖放圖片 · 點擊選檔 · Ctrl+V 貼上截圖</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => setImage(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
          {busy ? '分析中…' : '送出至大腦'}
        </button>
        {file ? (
          <button type="button" className="btn" onClick={() => setImage(null)}>
            清除圖片
          </button>
        ) : null}
      </div>
    </section>
  )
}
