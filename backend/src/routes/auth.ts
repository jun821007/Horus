import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { config } from '../config.js'
import { clearLoginRateLimit, checkLoginRateLimit } from '../lib/login-rate-limit.js'
import { AUTH_COOKIE_NAME, createSessionToken, sessionCookieOptions } from '../lib/session.js'
import { readSession } from '../middleware/requireAuth.js'

export const authRouter = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  remember: z.boolean().optional().default(true),
})

authRouter.post('/login', async (req, res) => {
  if (!config.authUsername || !config.authPasswordHash || !config.authSessionSecret) {
    return res.status(503).json({ ok: false, error: '登入尚未設定（缺少 AUTH_* 環境變數）' })
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const limited = checkLoginRateLimit(ip)
  if (!limited.ok) {
    res.setHeader('Retry-After', String(limited.retryAfterSec))
    return res.status(429).json({ ok: false, error: '嘗試過多，請稍後再試' })
  }

  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: '帳號或密碼格式錯誤' })

  const { username, password } = parsed.data
  const userOk = username === config.authUsername
  let passOk = false
  try {
    passOk = await bcrypt.compare(password, config.authPasswordHash)
  } catch {
    passOk = false
  }

  if (!userOk || !passOk) {
    return res.status(401).json({ ok: false, error: '帳號或密碼錯誤' })
  }

  clearLoginRateLimit(ip)
  const remember = parsed.data.remember !== false
  const token = createSessionToken(username)
  const cookie = { ...sessionCookieOptions() }
  if (!remember) {
    // session cookie (browser close clears it); still return bearer for SPA tab
    delete (cookie as { maxAge?: number }).maxAge
  }
  res.cookie(AUTH_COOKIE_NAME, token, cookie)
  return res.json({ ok: true, username, token, remember })
})

authRouter.get('/session', (req, res) => {
  const session = readSession(req)
  if (!session.authenticated) return res.json({ ok: true, authenticated: false })
  return res.json({ ok: true, authenticated: true, username: session.username })
})

authRouter.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: config.authCookieSameSite,
    path: '/',
  })
  return res.json({ ok: true })
})
