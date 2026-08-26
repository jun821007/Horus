import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { dispatchIngest } from '../services/dispatch.js'
import { confirmDraft } from '../services/inventory.js'
import { createLycheeShipment } from '../services/lychee.js'
import {
  addProfitAdjustment,
  createProfitCategory,
  deleteProfitAdjustment,
  deleteProfitCategory,
  getMonthProfitSummary,
  getProfitHistory,
  listProfitCategories,
} from '../services/profit.js'
import { getSupabase } from '../lib/supabase.js'
import { checkSupabaseConnection } from '../lib/supabase-check.js'
import { ideasRouter } from './ideas.js'
import { formatError } from '../lib/errors.js'
import { getDashboardSummary } from '../services/integration-cron.js'
import { isVisibleUnreadReminder } from '../services/reminders.js'
import { deletePushSubscription, getVapidPublicKey, upsertPushSubscription } from '../lib/web-push.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { authRouter } from './auth.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'horus-backend' })
})

apiRouter.use('/auth', authRouter)

apiRouter.use(requireAuth)

/** 想法輸入器（獨立於 /ingest） */
apiRouter.use('/ideas', ideasRouter)


/** 診斷 Supabase 連線（不洩漏 key） */
apiRouter.get('/supabase-check', async (_req, res) => {
  const report = await checkSupabaseConnection()
  res.status(report.ok ? 200 : 503).json(report)
})

apiRouter.get('/dashboard/summary', async (_req, res) => {
  try {
    const summary = await getDashboardSummary()
    res.json({ ok: true, ...summary })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

/** 模組一：全域語意分流器 */
apiRouter.post('/ingest', upload.single('image'), async (req, res) => {
  try {
    const text = String(req.body?.text ?? '')
    const file = req.file
    const image = file
      ? { buffer: file.buffer, mimeType: file.mimetype || 'image/jpeg' }
      : undefined

    const result = await dispatchIngest(text, image)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e) })
  }
})

apiRouter.get('/shipping-tracks', async (_req, res) => {
  const sb = getSupabase()
  const { data, error } = await sb.from('shipping_tracks').select('*').order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data })
})

apiRouter.get('/inventory-drafts', async (_req, res) => {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('inventory_drafts')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data })
})

apiRouter.post('/inventory-drafts/:id/confirm', async (req, res) => {
  try {
    const result = await confirmDraft(req.params.id)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e) })
  }
})

apiRouter.get('/inventories', async (_req, res) => {
  const sb = getSupabase()
  const { data, error } = await sb.from('inventories').select('*').order('item_name')
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data })
})

apiRouter.get('/reminders', async (_req, res) => {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('reminders')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ error: error.message })
  const items = (data ?? []).filter((r) => isVisibleUnreadReminder(r))
  res.json({ items })
})

apiRouter.patch('/reminders/:id/read', async (req, res) => {
  const sb = getSupabase()
  const { error } = await sb.from('reminders').update({ is_read: true }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})


apiRouter.get('/push/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey()
  if (!key) return res.status(503).json({ ok: false, error: 'VAPID_PUBLIC_KEY not configured' })
  res.json({ ok: true, publicKey: key })
})

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

apiRouter.post('/push/subscribe', async (req, res) => {
  const parsed = pushSubscribeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  try {
    await upsertPushSubscription({
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      user_agent: req.header('user-agent'),
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

apiRouter.delete('/push/subscribe', async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : ''
  if (!endpoint) return res.status(400).json({ ok: false, error: 'endpoint required' })
  try {
    await deletePushSubscription(endpoint)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

apiRouter.get('/lychee-shipments', async (_req, res) => {
  const sb = getSupabase()
  const { data, error } = await sb
    .from('lychee_shipments')
    .select('*')
    .order('target_ship_date', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data })
})

const lycheeSchema = z.object({
  order_label: z.string().min(1),
  target_ship_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items_summary: z.string().optional(),
})

apiRouter.post('/lychee-shipments', async (req, res) => {
  const parsed = lycheeSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const row = await createLycheeShipment(parsed.data)
    res.status(201).json({ ok: true, shipment: row })
  } catch (e) {
    res.status(400).json({ error: String(e) })
  }
})

apiRouter.get('/profits/summary', async (req, res) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined
    const summary = await getMonthProfitSummary(month)
    res.json({ ok: true, ...summary })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

apiRouter.get('/profits/history', async (req, res) => {
  try {
    const months = req.query.months ? Number(req.query.months) : 12
    const items = await getProfitHistory(Number.isFinite(months) ? months : 12)
    res.json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

apiRouter.get('/profits/categories', async (_req, res) => {
  try {
    const items = await listProfitCategories(true)
    res.json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

const categorySchema = z.object({ name: z.string().min(1) })

apiRouter.post('/profits/categories', async (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const row = await createProfitCategory(parsed.data.name)
    res.status(201).json({ ok: true, category: row })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

apiRouter.delete('/profits/categories/:id', async (req, res) => {
  try {
    await deleteProfitCategory(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

const adjustmentSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  item_name: z.string().min(1),
  net_profit: z.number(),
  profit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().optional(),
})

apiRouter.post('/profits/adjustments', async (req, res) => {
  const parsed = adjustmentSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const row = await addProfitAdjustment(parsed.data)
    res.status(201).json({ ok: true, adjustment: row })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

apiRouter.delete('/profits/adjustments/:id', async (req, res) => {
  try {
    await deleteProfitAdjustment(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})
