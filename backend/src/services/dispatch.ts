import { classifyAndParse } from '../lib/gemini.js'
import { ingestTrackingFromGemini, ingestTrackingFromText } from './shipping.js'
import { createDraftFromOcr } from './inventory.js'

export async function dispatchIngest(
  text: string,
  image?: { buffer: Buffer; mimeType: string },
) {
  const parsed = await classifyAndParse(text, image)

  if (parsed.task_type === 'taobao_ocr') {
    const result = await createDraftFromOcr(parsed)
    return {
      task_type: 'taobao_ocr' as const,
      message: `已建立待確認入庫：${parsed.item_name} x${parsed.quantity}`,
      draft: result.draft,
      rates: {
        exchange_rate: result.exchangeRate,
        unit_cost_twd: result.unitCostTwd,
      },
    }
  }

  if (parsed.task_type === 'tracking_text') {
    const track = await ingestTrackingFromGemini(parsed, text)
    return {
      task_type: 'tracking_text' as const,
      message: `已登記 ${track.carrier} 單號 ${track.tracking_number}`,
      tracking: track,
    }
  }

  if (text.trim()) {
    const track = await ingestTrackingFromText(text)
    return {
      task_type: 'tracking_text' as const,
      message: `已登記 ${track.carrier} 單號 ${track.tracking_number}`,
      tracking: track,
    }
  }

  return { task_type: 'unknown' as const, message: '無法辨識輸入' }
}
