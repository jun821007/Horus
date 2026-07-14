import { apiGet, apiPost } from './api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export function isStandaloneDisplay(): boolean {
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const ios = Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return mq || ios
}

export function canUseWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function ensurePushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!canUseWebPush()) return null
  return navigator.serviceWorker.register('/sw.js')
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!canUseWebPush()) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

export async function subscribeArrivalPush(): Promise<void> {
  if (!canUseWebPush()) throw new Error('此裝置不支援 Web Push')
  const { publicKey } = await apiGet<{ ok: boolean; publicKey: string }>('/api/push/vapid-public-key')
  const reg = await ensurePushServiceWorker()
  if (!reg) throw new Error('Service Worker 註冊失敗')
  await navigator.serviceWorker.ready

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('未允許通知權限')

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  }

  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('訂閱資料不完整')
  }
  await apiPost('/api/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  })
}
