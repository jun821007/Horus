import { classifyAndParse } from '../lib/gemini.js'
import { createDraftFromOcr } from './inventory.js'

export async function dispatchIngest(
  text: string,
  image?: { buffer: Buffer; mimeType: string },
) {
  const parsed = await classifyAndParse(text, image)

  if (parsed.task_type === 'tracking_text') {
    return {
      task_type: 'unknown' as const,
      message: '單號改由 Order number 自動同步，請改貼淘寶採購截圖建立入庫草稿',
    }
  }

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

  if (!image) {
    return { task_type: 'unknown' as const, message: '請貼上淘寶採購截圖建立入庫草稿' }
  }

  return { task_type: 'unknown' as const, message: '無法辨識輸入' }
}
