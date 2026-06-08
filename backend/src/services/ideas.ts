import { getSupabase } from '../lib/supabase.js'
import {
  analyzeIdeaText,
  formatPlansMarkdown,
  type IdeaAnalysisParsed,
  type IdeaPlanParsed,
} from '../lib/gemini-ideas.js'

export type IdeaCategory = {
  id: string
  parent_id: string | null
  name: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type IdeaRecord = {
  id: string
  title: string
  status: string
  category_id: string | null
  priority: string | null
  priority_manual: number | null
  adopted_plan_index: number | null
  map_node_id: string | null
  goal_id: string | null
  created_at: string
  updated_at: string
}

export type IdeaMessage = {
  id: string
  idea_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export type IdeaPlanRow = {
  id: string
  idea_id: string
  plan_index: number
  title: string
  problem_points: string[]
  actions: string[]
  next_step: string
  created_at: string
}

async function categoryDepth(parentId: string | null): Promise<number> {
  if (!parentId) return 0
  const sb = getSupabase()
  const { data: parentRow } = await sb
    .from('idea_categories')
    .select('parent_id')
    .eq('id', parentId)
    .maybeSingle()
  if (!parentRow?.parent_id) return 1
  const { data: grandRow } = await sb
    .from('idea_categories')
    .select('parent_id')
    .eq('id', parentRow.parent_id)
    .maybeSingle()
  if (!grandRow?.parent_id) return 2
  return 3
}

export async function listCategories(activeOnly = false): Promise<IdeaCategory[]> {
  const sb = getSupabase()
  let q = sb.from('idea_categories').select('*').order('sort_order')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as IdeaCategory[]
}

export async function createCategory(input: {
  name: string
  parent_id?: string | null
  sort_order?: number
}): Promise<IdeaCategory> {
  const name = input.name.trim()
  if (!name) throw new Error('分類名稱不可空白')

  const parentId = input.parent_id ?? null
  const depth = await categoryDepth(parentId)
  if (depth >= 3) throw new Error('分類最多 3 層')

  const sb = getSupabase()
  const dup = await sb
    .from('idea_categories')
    .select('id')
    .eq('name', name)
    .is('parent_id', parentId)
    .maybeSingle()
  if (dup.data) throw new Error('同層已有相同分類名稱')

  const { data, error } = await sb
    .from('idea_categories')
    .insert({
      name,
      parent_id: parentId,
      sort_order: input.sort_order ?? 0,
      is_active: true,
    })
    .select()
    .single()
  if (error) throw error
  return data as IdeaCategory
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<IdeaCategory, 'name' | 'parent_id' | 'sort_order' | 'is_active'>>,
): Promise<IdeaCategory> {
  const sb = getSupabase()
  if (patch.parent_id !== undefined) {
    const depth = await categoryDepth(patch.parent_id)
    if (depth >= 3) throw new Error('分類最多 3 層')
  }
  if (patch.name) {
    const { data: current } = await sb.from('idea_categories').select('parent_id').eq('id', id).single()
    const parentId = patch.parent_id !== undefined ? patch.parent_id : (current?.parent_id as string | null)
    const dup = await sb
      .from('idea_categories')
      .select('id')
      .eq('name', patch.name.trim())
      .is('parent_id', parentId)
      .neq('id', id)
      .maybeSingle()
    if (dup.data) throw new Error('同層已有相同分類名稱')
  }

  const { data, error } = await sb.from('idea_categories').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as IdeaCategory
}

export async function deleteCategory(id: string): Promise<void> {
  const sb = getSupabase()
  const { count: childCount } = await sb
    .from('idea_categories')
    .select('*', { count: 'exact', head: true })
    .eq('parent_id', id)
  if ((childCount ?? 0) > 0) throw new Error('請先刪除子分類')

  const { count: ideaCount } = await sb
    .from('ideas')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', id)
  if ((ideaCount ?? 0) > 0) throw new Error('此分類仍有關聯想法，無法刪除')

  const { error } = await sb.from('idea_categories').delete().eq('id', id)
  if (error) throw error
}

export async function listIdeas(filters?: { status?: string; category_id?: string }): Promise<IdeaRecord[]> {
  const sb = getSupabase()
  let q = sb.from('ideas').select('*').order('updated_at', { ascending: false })
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.category_id) q = q.eq('category_id', filters.category_id)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as IdeaRecord[]
}

export async function getIdeaDetail(id: string) {
  const sb = getSupabase()
  const { data: idea, error: ideaErr } = await sb.from('ideas').select('*').eq('id', id).single()
  if (ideaErr) throw ideaErr

  const { data: messages, error: msgErr } = await sb
    .from('idea_messages')
    .select('*')
    .eq('idea_id', id)
    .order('created_at')
  if (msgErr) throw msgErr

  const { data: plans, error: planErr } = await sb
    .from('idea_plans')
    .select('*')
    .eq('idea_id', id)
    .order('created_at', { ascending: false })
  if (planErr) throw planErr

  return {
    idea: idea as IdeaRecord,
    messages: (messages ?? []) as IdeaMessage[],
    plans: (plans ?? []).map(normalizePlanRow),
  }
}

function normalizePlanRow(row: Record<string, unknown>): IdeaPlanRow {
  return {
    id: String(row.id),
    idea_id: String(row.idea_id),
    plan_index: Number(row.plan_index),
    title: String(row.title ?? ''),
    problem_points: Array.isArray(row.problem_points) ? row.problem_points.map(String) : [],
    actions: Array.isArray(row.actions) ? row.actions.map(String) : [],
    next_step: String(row.next_step ?? ''),
    created_at: String(row.created_at),
  }
}

async function persistAiRound(ideaId: string, analysis: IdeaAnalysisParsed, categoryName: string) {
  const sb = getSupabase()
  const markdown = formatPlansMarkdown(categoryName, analysis)

  const { data: assistantMsg, error: msgErr } = await sb
    .from('idea_messages')
    .insert({
      idea_id: ideaId,
      role: 'assistant',
      content: markdown,
      metadata: {
        priority: analysis.priority,
        priority_reason: analysis.priority_reason,
        category_id: analysis.category_id,
      },
    })
    .select()
    .single()
  if (msgErr) throw msgErr

  const planRows = analysis.plans.map((p) => ({
    idea_id: ideaId,
    plan_index: p.plan_index,
    title: p.title,
    problem_points: p.problem_points,
    actions: p.actions,
    next_step: p.next_step,
  }))
  const { data: savedPlans, error: planErr } = await sb.from('idea_plans').insert(planRows).select()
  if (planErr) throw planErr

  return { assistantMsg: assistantMsg as IdeaMessage, plans: (savedPlans ?? []).map(normalizePlanRow) }
}

async function processIdeaAnalysis(ideaId: string): Promise<void> {
  const detail = await getIdeaDetail(ideaId)
  const trimmed = [...detail.messages].reverse().find((m) => m.role === 'user')?.content?.trim()
  if (!trimmed) throw new Error('找不到想法內容')

  const categories = await listCategories(true)
  if (categories.length === 0) throw new Error('請先建立至少一個啟用分類')

  const analysis = await analyzeIdeaText(trimmed, categories)
  const categoryName = categories.find((c) => c.id === analysis.category_id)?.name ?? '其他'
  await persistAiRound(ideaId, analysis, categoryName)

  const sb = getSupabase()
  const { error: updErr } = await sb
    .from('ideas')
    .update({
      title: analysis.title,
      category_id: analysis.category_id,
      priority: analysis.priority,
      status: 'pending',
    })
    .eq('id', ideaId)
  if (updErr) throw updErr
}

function queueIdeaAnalysis(ideaId: string): void {
  void processIdeaAnalysis(ideaId).catch(async (e) => {
    const sb = getSupabase()
    const msg = e instanceof Error ? e.message : String(e)
    await sb.from('idea_messages').insert({
      idea_id: ideaId,
      role: 'system',
      content: `AI 分析失敗：${msg}`,
      metadata: { error: true },
    })
    await sb.from('ideas').update({ status: 'pending' }).eq('id', ideaId)
  })
}

export async function createIdea(text: string) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('請輸入想法')

  const categories = await listCategories(true)
  if (categories.length === 0) throw new Error('請先建立至少一個啟用分類')

  const sb = getSupabase()
  const { data: idea, error: ideaErr } = await sb
    .from('ideas')
    .insert({ title: trimmed.slice(0, 80), status: 'processing' })
    .select()
    .single()
  if (ideaErr) throw ideaErr

  const { data: userMsg, error: userErr } = await sb
    .from('idea_messages')
    .insert({ idea_id: idea.id, role: 'user', content: trimmed })
    .select()
    .single()
  if (userErr) throw userErr

  queueIdeaAnalysis(idea.id)

  return {
    idea: idea as IdeaRecord,
    messages: [userMsg as IdeaMessage],
    plans: [] as IdeaPlanRow[],
  }
}

export async function appendIdeaMessage(ideaId: string, text: string) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('請輸入內容')

  const { idea } = await getIdeaDetail(ideaId)
  if (!['draft', 'pending'].includes(idea.status)) {
    throw new Error('此想法已結案，無法繼續對話')
  }

  const categories = await listCategories(true)
  const sb = getSupabase()

  const { data: userMsg, error: userErr } = await sb
    .from('idea_messages')
    .insert({ idea_id: ideaId, role: 'user', content: trimmed })
    .select()
    .single()
  if (userErr) throw userErr

  const analysis = await analyzeIdeaText(trimmed, categories)
  const categoryName = categories.find((c) => c.id === analysis.category_id)?.name ?? '其他'
  const { assistantMsg, plans } = await persistAiRound(ideaId, analysis, categoryName)

  const { data: updated, error: updErr } = await sb
    .from('ideas')
    .update({
      title: analysis.title,
      category_id: analysis.category_id,
      priority: analysis.priority,
    })
    .eq('id', ideaId)
    .select()
    .single()
  if (updErr) throw updErr

  const detail = await getIdeaDetail(ideaId)
  return { idea: updated as IdeaRecord, messages: detail.messages, plans: detail.plans, latest: { userMsg, assistantMsg, plans } }
}

const DECISION_LABELS: Record<string, string> = {
  adopt_1: '已採用方案一',
  adopt_2: '已採用方案二',
  pending: '已暫緩',
  archive: '已丟棄',
}

export async function applyDecision(
  ideaId: string,
  action: 'adopt_1' | 'adopt_2' | 'pending' | 'archive',
) {
  const { idea } = await getIdeaDetail(ideaId)
  if (!['draft', 'pending'].includes(idea.status)) {
    throw new Error('此想法已處理過')
  }

  const sb = getSupabase()
  let status = idea.status
  let adopted_plan_index: number | null = null

  if (action === 'adopt_1') {
    status = 'adopted'
    adopted_plan_index = 1
  } else if (action === 'adopt_2') {
    status = 'adopted'
    adopted_plan_index = 2
  } else if (action === 'pending') {
    status = 'pending'
  } else if (action === 'archive') {
    status = 'archived'
  }

  const { data: updated, error } = await sb
    .from('ideas')
    .update({ status, adopted_plan_index })
    .eq('id', ideaId)
    .select()
    .single()
  if (error) throw error

  await sb.from('idea_messages').insert({
    idea_id: ideaId,
    role: 'system',
    content: DECISION_LABELS[action] ?? action,
    metadata: { action },
  })

  return updated as IdeaRecord
}

export function planToCopyText(planIndex: 1 | 2, plan: IdeaPlanParsed | IdeaPlanRow): string {
  const label = planIndex === 1 ? '方案一' : '方案二'
  const problems = plan.problem_points.map((p) => `- ${p}`).join('\n') || '- （無）'
  const actions = plan.actions.map((a) => `- ${a}`).join('\n') || '- （無）'
  return [
    `【${label}：${plan.title}】`,
    '問題點：',
    problems,
    '行動建議：',
    actions,
    `下一步：${plan.next_step || '—'}`,
  ].join('\n')
}
