import { Router } from 'express'
import { z } from 'zod'
import { formatError } from '../lib/errors.js'
import {
  appendIdeaMessage,
  applyDecision,
  createCategory,
  createIdea,
  deleteCategory,
  getIdeaDetail,
  listCategories,
  listIdeas,
  updateCategory,
} from '../services/ideas.js'

export const ideasRouter = Router()

ideasRouter.get('/categories', async (req, res) => {
  try {
    const activeOnly = req.query.active !== '0'
    const items = await listCategories(activeOnly)
    res.json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

const categorySchema = z.object({
  name: z.string().min(1),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
})

ideasRouter.post('/categories', async (req, res) => {
  const parsed = categorySchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  try {
    const item = await createCategory(parsed.data)
    res.status(201).json({ ok: true, item })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

ideasRouter.patch('/categories/:id', async (req, res) => {
  try {
    const item = await updateCategory(req.params.id, req.body)
    res.json({ ok: true, item })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

ideasRouter.delete('/categories/:id', async (req, res) => {
  try {
    await deleteCategory(req.params.id)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

ideasRouter.get('/', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const category_id = typeof req.query.category_id === 'string' ? req.query.category_id : undefined
    const items = await listIdeas({ status, category_id })
    res.json({ ok: true, items })
  } catch (e) {
    res.status(500).json({ ok: false, error: formatError(e) })
  }
})

ideasRouter.get('/:id', async (req, res) => {
  try {
    const detail = await getIdeaDetail(req.params.id)
    res.json({ ok: true, ...detail })
  } catch (e) {
    res.status(404).json({ ok: false, error: formatError(e) })
  }
})

const textSchema = z.object({ text: z.string().min(1) })

ideasRouter.post('/', async (req, res) => {
  const parsed = textSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  try {
    const result = await createIdea(parsed.data.text)
    res.status(201).json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

ideasRouter.post('/:id/messages', async (req, res) => {
  const parsed = textSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  try {
    const result = await appendIdeaMessage(req.params.id, parsed.data.text)
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})

const decisionSchema = z.object({
  action: z.enum(['adopt_1', 'adopt_2', 'pending', 'archive']),
})

ideasRouter.patch('/:id/decision', async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  try {
    const idea = await applyDecision(req.params.id, parsed.data.action)
    res.json({ ok: true, idea })
  } catch (e) {
    res.status(400).json({ ok: false, error: formatError(e) })
  }
})
