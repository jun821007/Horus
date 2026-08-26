import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE_NAME, verifySessionToken } from '../lib/session.js'

export type AuthedRequest = Request & { authUser?: string }

function extractToken(req: Request): string | null {
  const header = req.header('authorization') || ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  if (m?.[1]) return m[1].trim()
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[AUTH_COOKIE_NAME]
  if (cookieToken) return cookieToken
  return null
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const payload = verifySessionToken(extractToken(req))
  if (!payload) {
    res.status(401).json({ ok: false, error: '未登入或登入已過期' })
    return
  }
  req.authUser = payload.u
  next()
}

export function readSession(req: Request): { authenticated: boolean; username?: string } {
  const payload = verifySessionToken(extractToken(req))
  if (!payload) return { authenticated: false }
  return { authenticated: true, username: payload.u }
}
