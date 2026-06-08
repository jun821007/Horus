import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '../config.js'

export type CategoryNode = {
  id: string
  name: string
  parent_id: string | null
}

export type IdeaPlanParsed = {
  plan_index: 1 | 2
  title: string
  problem_points: string[]
  actions: string[]
  next_step: string
}

export type IdeaAnalysisParsed = {
  category_id: string
  priority: 'P0' | 'P1' | 'P2'
  priority_reason: string
  title: string
  plans: IdeaPlanParsed[]
}

const IDEAS_SYSTEM = `你是 Horus「想法輸入器」顧問。使用者輸入一個念頭，你協助分類、建議優先級、產出兩套行動方案。

規則：
- 全部繁體中文
- 禁止程式碼、英文句子、寒暄、或給 Cursor 的技術指令
- category_id 必須來自使用者提供的分類清單中的 id
- plans 固定兩筆：plan_index 1 與 2
- 每方案最多 3 個 problem_points、3 個 actions

只回傳 JSON：
{
  "category_id": "uuid",
  "priority": "P0",
  "priority_reason": "一句話",
  "title": "想法摘要標題",
  "plans": [
    {
      "plan_index": 1,
      "title": "方案標題",
      "problem_points": ["問題點"],
      "actions": ["行動建議"],
      "next_step": "下一步"
    },
    {
      "plan_index": 2,
      "title": "方案標題",
      "problem_points": ["問題點"],
      "actions": ["行動建議"],
      "next_step": "下一步"
    }
  ]
}`

function parseJsonBlock(text: string): unknown {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence ? fence[1].trim() : trimmed
  try {
    return JSON.parse(body)
  } catch {
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1))
    throw new Error('Gemini ideas JSON 解析失敗')
  }
}

function normalizePlans(raw: unknown): IdeaPlanParsed[] {
  const arr = Array.isArray(raw) ? raw : []
  const plans: IdeaPlanParsed[] = []
  for (const idx of [1, 2] as const) {
    const found = arr.find((p) => Number((p as IdeaPlanParsed)?.plan_index) === idx) as Partial<IdeaPlanParsed> | undefined
    plans.push({
      plan_index: idx,
      title: String(found?.title ?? `方案${idx === 1 ? '一' : '二'}`),
      problem_points: Array.isArray(found?.problem_points) ? found!.problem_points.map(String).slice(0, 3) : [],
      actions: Array.isArray(found?.actions) ? found!.actions.map(String).slice(0, 3) : [],
      next_step: String(found?.next_step ?? ''),
    })
  }
  return plans
}

export function formatPlansMarkdown(
  categoryName: string,
  analysis: Pick<IdeaAnalysisParsed, 'priority' | 'priority_reason' | 'plans'>,
): string {
  const fmtPlan = (plan: IdeaPlanParsed) => {
    const problems = plan.problem_points.map((p) => `- ${p}`).join('\n') || '- （無）'
    const actions = plan.actions.map((a) => `- ${a}`).join('\n') || '- （無）'
    return [
      `## 方案${plan.plan_index === 1 ? '一' : '二'}：${plan.title}`,
      '**問題點**',
      problems,
      '**行動建議**',
      actions,
      '**下一步**',
      `- ${plan.next_step || '—'}`,
    ].join('\n')
  }

  return [
    `**分類**：${categoryName}`,
    `**優先建議**：${analysis.priority} — ${analysis.priority_reason}`,
    '',
    fmtPlan(analysis.plans[0]),
    '',
    fmtPlan(analysis.plans[1]),
  ].join('\n')
}

export async function analyzeIdeaText(
  userText: string,
  categories: CategoryNode[],
): Promise<IdeaAnalysisParsed> {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY missing')

  const genAI = new GoogleGenerativeAI(config.geminiApiKey)
  const model = genAI.getGenerativeModel({
    model: config.geminiFlashModel,
    systemInstruction: IDEAS_SYSTEM,
  })

  const catsJson = JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id })))
  const prompt = [
    '啟用中分類樹 JSON：',
    catsJson,
    '',
    '使用者想法：',
    userText,
  ].join('\n')

  let text: string
  try {
    const result = await model.generateContent(prompt)
    text = result.response.text().trim()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/not found|404|invalid model/i.test(msg)) {
      throw new Error(
        `Gemini 模型不可用 (${config.geminiFlashModel})，請將 GEMINI_FLASH_MODEL 改為 gemini-3.5-flash 或 gemini-2.5-flash`,
      )
    }
    throw new Error(`Gemini 呼叫失敗: ${msg}`)
  }

  const parsed = parseJsonBlock(text) as Partial<IdeaAnalysisParsed>

  const priority = parsed.priority === 'P0' || parsed.priority === 'P1' || parsed.priority === 'P2'
    ? parsed.priority
    : 'P1'

  const validCat = categories.find((c) => c.id === parsed.category_id)
  const fallbackCat = categories[0]

  return {
    category_id: validCat?.id ?? fallbackCat?.id ?? parsed.category_id ?? '',
    priority,
    priority_reason: String(parsed.priority_reason ?? ''),
    title: String(parsed.title ?? userText.slice(0, 60)),
    plans: normalizePlans(parsed.plans),
  }
}
