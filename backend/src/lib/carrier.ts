export type Carrier = '新竹物流' | '黑貓' | '超商'

const digitsOnly = (s: string) => s.replace(/\D/g, '')

/** 後端正則 + 編碼特徵辨識台灣物流 */
export function detectCarrier(trackingNumber: string): Carrier | null {
  const n = digitsOnly(trackingNumber.trim())
  if (!n) return null

  // 黑貓宅急便：常見 12 碼
  if (/^\d{12}$/.test(n)) return '黑貓'

  // 新竹物流：常見 10 碼
  if (/^\d{10}$/.test(n)) return '新竹物流'

  // 超商取貨：7–15 碼，常見 8 碼或以 3/4/5 開頭
  if (/^\d{7,15}$/.test(n) && (/^[345]/.test(n) || n.length === 8)) return '超商'

  // 兜底：8–11 碼偏新竹，其餘偏超商
  if (n.length >= 8 && n.length <= 11) return '新竹物流'
  if (n.length >= 7 && n.length <= 15) return '超商'

  return null
}

export function extractTrackingCandidates(text: string): string[] {
  const found = new Set<string>()
  const patterns = [
    /\b\d{10}\b/g,
    /\b\d{12}\b/g,
    /\b\d{7,15}\b/g,
  ]
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const n = digitsOnly(m[0])
      if (n.length >= 7 && n.length <= 15) found.add(n)
    }
  }
  return [...found]
}
