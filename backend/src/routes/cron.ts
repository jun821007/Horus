import { Router } from 'express'
import { requireCronSecret } from '../middleware/cronAuth.js'
import { runDailyTrackingCron } from '../services/shipping.js'
import { runShipReminderCron } from '../services/lychee.js'

export const cronRouter = Router()

cronRouter.use(requireCronSecret)

/** 每日物流追蹤（Railway Cron 觸發） */
cronRouter.post('/tracking-daily', async (_req, res) => {
  try {
    const result = await runDailyTrackingCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

/** 每日下午出貨預警（篩選 target_ship_date = 明天） */
cronRouter.post('/ship-reminder', async (_req, res) => {
  try {
    const result = await runShipReminderCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

/** 合併每日任務（單一 Cron 入口） */
cronRouter.post('/daily', async (_req, res) => {
  try {
    const tracking = await runDailyTrackingCron()
    const ship = await runShipReminderCron()
    res.json({ ok: true, tracking, ship })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})
