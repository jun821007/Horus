import webpush from 'web-push'
import { config } from '../config.js'
import { getSupabase } from './supabase.js'

export type PushSubscriptionRow = {
  endpoint: string
  p256dh: string
  auth: string
}

let configured = false

function ensureWebPush(): boolean {
  if (configured) return true
  if (!config.vapidPublicKey || !config.vapidPrivateKey) return false
  webpush.setVapidDetails(
    config.vapidSubject,
    config.vapidPublicKey,
    config.vapidPrivateKey,
  )
  configured = true
  return true
}

export function getVapidPublicKey(): string | null {
  return config.vapidPublicKey || null
}

export async function upsertPushSubscription(input: {
  endpoint: string
  p256dh: string
  auth: string
  user_agent?: string | null
}): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('push_subscriptions').upsert(
    {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.user_agent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const sb = getSupabase()
  const { error } = await sb.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function sendArrivalPush(title: string, body: string, trackingNumber?: string): Promise<{
  sent: number
  failed: number
}> {
  if (!ensureWebPush()) return { sent: 0, failed: 0 }

  const sb = getSupabase()
  const { data, error } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth')
  if (error) throw error

  const payload = JSON.stringify({
    title,
    body,
    url: '/',
    kind: 'arrival',
    tracking_number: trackingNumber ?? null,
  })

  let sent = 0
  let failed = 0
  for (const row of data ?? []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        payload,
        { TTL: 60 * 60 * 12, urgency: 'high' },
      )
      sent += 1
    } catch (e: unknown) {
      failed += 1
      const statusCode = typeof e === 'object' && e && 'statusCode' in e ? Number((e as { statusCode?: number }).statusCode) : 0
      if (statusCode === 404 || statusCode === 410) {
        await deletePushSubscription(row.endpoint).catch(() => undefined)
      } else {
        console.warn('[web-push]', row.endpoint.slice(0, 48), e)
      }
    }
  }

  return { sent, failed }
}
