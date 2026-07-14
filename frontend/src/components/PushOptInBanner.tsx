import { useEffect, useState } from 'react'
import {
  canUseWebPush,
  getExistingPushSubscription,
  isStandaloneDisplay,
  subscribeArrivalPush,
} from '../lib/push'

type State = 'loading' | 'unsupported' | 'need_homescreen' | 'ready' | 'subscribed' | 'error'

export function PushOptInBanner() {
  const [state, setState] = useState<State>('loading')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!canUseWebPush()) {
        if (!cancelled) setState('unsupported')
        return
      }
      if (!isStandaloneDisplay()) {
        if (!cancelled) setState('need_homescreen')
        return
      }
      const sub = await getExistingPushSubscription().catch(() => null)
      if (!cancelled) setState(sub ? 'subscribed' : 'ready')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onEnable = async () => {
    setBusy(true)
    setMsg('')
    try {
      await subscribeArrivalPush()
      setState('subscribed')
      setMsg('已開啟到貨推播')
    } catch (e) {
      setState('error')
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (state === 'loading' || state === 'subscribed') {
    if (state === 'subscribed' && msg) {
      return <div className="push-banner push-banner--ok">{msg}</div>
    }
    return null
  }

  if (state === 'unsupported') {
    return (
      <div className="push-banner">
        此瀏覽器不支援系統通知。iPhone 請用 Safari 16.4 以上，並加到主畫面後開啟。
      </div>
    )
  }

  if (state === 'need_homescreen') {
    return (
      <div className="push-banner">
        <strong>開啟到貨推播（iPhone）</strong>
        <ol className="push-steps">
          <li>用 Safari 打開本頁</li>
          <li>點分享 →「加入主畫面」</li>
          <li>從主畫面圖示打開 Horus</li>
          <li>再點下方按鈕允許通知</li>
        </ol>
        <p className="push-note">在 Safari 分頁內無法推播，必須從主畫面進入。</p>
      </div>
    )
  }

  return (
    <div className="push-banner">
      <strong>到貨系統通知</strong>
      <p className="push-note">關閉 App 也能收到「請領貨」通知。</p>
      {msg ? <p className="push-note push-note--err">{msg}</p> : null}
      <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onEnable()}>
        {busy ? '設定中…' : '開啟到貨推播'}
      </button>
    </div>
  )
}
