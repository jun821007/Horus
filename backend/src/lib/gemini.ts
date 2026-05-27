import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from '../config.js'

export type TaskType = 'tracking_text' | 'taobao_ocr' | 'unknown'

export type GeminiTrackingResult = {
  task_type: 'tracking_text'
  tracking_number: string
  content_summary: string
  carrier_hint?: string
}

export type GeminiTaobaoResult = {
  task_type: 'taobao_ocr'
  item_name: string
  rmb_amount: number
  twd_amount: number
  quantity: number
}

export type GeminiParseResult = GeminiTrackingResult | GeminiTaobaoResult | { task_type: 'unknown'; raw: string }

const TRACKING_SYSTEM = `你是台灣物流單號解析器。從使用者文字提取：
- tracking_number：純數字單號（7-15位）
- content_summary：內容物描述（簡短）
- carrier_hint：新竹物流 | 黑貓 | 超商 或空字串
只回傳 JSON，格式：
{"task_type":"tracking_text","tracking_number":"...","content_summary":"...","carrier_hint":"..."}`

const TAOBAO_SYSTEM = `你是淘寶採購截圖 OCR。提取：
- item_name 品名
- rmb_amount 人民幣金額（數字）
- twd_amount 台幣結帳金額（數字）
- quantity 數量（整數，預設1）
只回傳 JSON：
{"task_type":"taobao_ocr","item_name":"...","rmb_amount":0,"twd_amount":0,"quantity":1}`

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
    throw new Error('Invalid JSON from Gemini')
  }
}

async function runModel(modelName: string, system: string, parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>): Promise<string> {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY missing')
  const genAI = new GoogleGenerativeAI(config.geminiApiKey)
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: system })
  const result = await model.generateContent(parts)
  return result.response.text().trim()
}

/** 任務 A：純文字單號 → gemini-2.5-flash */
export async function parseTrackingText(userText: string): Promise<GeminiTrackingResult> {
  const raw = await runModel(config.geminiFlashModel, TRACKING_SYSTEM, [{ text: userText }])
  const parsed = parseJsonBlock(raw) as GeminiTrackingResult
  if (parsed.task_type !== 'tracking_text' || !parsed.tracking_number) {
    throw new Error('Gemini tracking parse failed')
  }
  return parsed
}

/** 任務 B：淘寶截圖 → gemini-2.5-pro */
export async function parseTaobaoImage(buffer: Buffer, mimeType: string): Promise<GeminiTaobaoResult> {
  const raw = await runModel(config.geminiProModel, TAOBAO_SYSTEM, [
    { text: '請 OCR 此淘寶採購截圖並輸出 JSON。' },
    { inlineData: { mimeType, data: buffer.toString('base64') } },
  ])
  const parsed = parseJsonBlock(raw) as GeminiTaobaoResult
  if (parsed.task_type !== 'taobao_ocr' || !parsed.item_name) {
    throw new Error('Gemini taobao OCR failed')
  }
  return {
    task_type: 'taobao_ocr',
    item_name: String(parsed.item_name),
    rmb_amount: Number(parsed.rmb_amount) || 0,
    twd_amount: Number(parsed.twd_amount) || 0,
    quantity: Math.max(1, Math.floor(Number(parsed.quantity) || 1)),
  }
}

/** 有圖片走 Pro OCR；純文字走 Flash */
export async function classifyAndParse(
  text: string,
  image?: { buffer: Buffer; mimeType: string },
): Promise<GeminiParseResult> {
  if (image) {
    return parseTaobaoImage(image.buffer, image.mimeType)
  }
  if (text.trim()) {
    return parseTrackingText(text)
  }
  return { task_type: 'unknown', raw: '' }
}
