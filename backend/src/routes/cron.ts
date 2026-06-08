import { Router } from 'express'
import { requireCronSecret } from '../middleware/cronAuth.js'
import { runDailyTrackingCron } from '../services/shipping.js'
import { runShipReminderCron } from '../services/lychee.js'
import { runHotSellerReminderCron, runLycheeTomorrowReminderCron } from '../services/integration-cron.js'

export const cronRouter = Router()

cronRouter.use(requireCronSecret)

cronRouter.post('/tracking-daily', async (_req, res) => {
  try {
    const result = await runDailyTrackingCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

cronRouter.post('/lychee-tomorrow', async (_req, res) => {
  try {
    const result = await runLycheeTomorrowReminderCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

cronRouter.post('/hot-sellers', async (_req, res) => {
  try {
    const result = await runHotSellerReminderCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

cronRouter.post('/ship-reminder', async (_req, res) => {
  try {
    const result = await runShipReminderCron()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

cronRouter.post('/daily', async (_req, res) => {
  try {
    const tracking = await runDailyTrackingCron()
    const lychee = await runLycheeTomorrowReminderCron()
    const hot = await runHotSellerReminderCron()
    res.json({ ok: true, tracking, lychee, hot })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})
