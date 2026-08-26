import crypto from 'node:crypto'
import { config } from '../config.js'

export const AUTH_COOKIE_NAME = 'horus_session'

export type SessionPayload = {
  u: string
  exp: number
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function sign(data: string): string {
  return crypto.createHmac('sha256', config.authSessionSecret).update(data).digest('base64url')
}

export function createSessionToken(username: string, rememberDays = config.authRememberDays): string {
  const exp = Date.now() + Math.max(1, rememberDays) * 24 * 60 * 60 * 1000
  const payload = b64url(Buffer.from(JSON.stringify({ u: username, exp } satisfies SessionPayload), 'utf8'))
  const sig = sign(payload)
  return payload + '.' + sig
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || !config.authSessionSecret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = sign(payload)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload
    if (!raw?.u || typeof raw.exp !== 'number') return null
    if (raw.exp < Date.now()) return null
    return raw
  } catch {
    return null
  }
}

export function sessionCookieOptions() {
  const maxAgeMs = Math.max(1, config.authRememberDays) * 24 * 60 * 60 * 1000
  const sameSite = config.authCookieSameSite
  return {
    httpOnly: true,
    secure: true,
    sameSite,
    maxAge: maxAgeMs,
    path: '/',
  } as const
}
