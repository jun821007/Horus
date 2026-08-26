type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10

export function checkLoginRateLimit(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const key = ip || 'unknown'
  let bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(key, bucket)
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) }
  }
  bucket.count += 1
  return { ok: true }
}

export function clearLoginRateLimit(ip: string): void {
  buckets.delete(ip || 'unknown')
}
