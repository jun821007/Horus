import type { Request, Response, NextFunction } from 'express'
import { config } from '../config.js'

export function requireCronSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = config.cronSecret
  if (!secret) {
    res.status(503).json({ error: 'CRON_SECRET not configured' })
    return
  }
  const header = req.header('x-cron-secret') ?? req.query.secret
  if (header !== secret) {
    res.status(401).json({ error: 'Unauthorized cron' })
    return
  }
  next()
}
