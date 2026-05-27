import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { dispatchIngest } from '../services/dispatch.js'
import { confirmDraft } from '../services/inventory.js'
import { createLycheeShipment } from '../services/lychee.js'
import { recordPosSale, getProfitSummary } from '../services/pos.js'
import { getSupabase } from '../lib/supabase.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'horus-backend' })
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
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ items: data })
})

apiRouter.patch('/reminders/:id/read', async (req, res) => {
  const sb = getSupabase()
  const { error } = await sb.from('reminders').update({ is_read: true }).eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
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

const posSchema = z.object({
  item_name: z.string().min(1),
  quantity: z.number().int().positive().optional(),
  sale_amount: z.number().nonnegative(),
  order_ref: z.string().optional(),
})

apiRouter.post('/pos/checkout', async (req, res) => {
  const parsed = posSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })
  try {
    const result = await recordPosSale(parsed.data)
    res.status(201).json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ error: String(e) })
  }
})

apiRouter.get('/profits/summary', async (_req, res) => {
  try {
    const summary = await getProfitSummary()
    res.json(summary)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
})
