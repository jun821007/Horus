export type Carrier = '新竹物流' | '黑貓' | '超商'

const digitsOnly = (s: string) => s.replace(/\D/g, '')

export function carrierFromShippingMethod(method: string | null | undefined): Carrier | null {
  const m = (method ?? '').trim()
  if (m === '新竹') return '新竹物流'
  if (m === '黑貓') return '黑貓'
  if (m === '超商') return '超商'
  return null
}

export function detectCarrier(trackingNumber: string): Carrier | null {
  const n = digitsOnly(trackingNumber.trim())
  if (!n) return null
  if (/^\d{12}$/.test(n)) return '黑貓'
  if (/^\d{10}$/.test(n)) return '新竹物流'
  if (/^\d{7,15}$/.test(n) && (/^[345]/.test(n) || n.length === 8)) return '超商'
  if (n.length >= 8 && n.length <= 11) return '新竹物流'
  if (n.length >= 7 && n.length <= 15) return '超商'
  return null
}

export function resolveCarrier(trackingNumber: string, shippingMethod?: string | null): Carrier {
  return carrierFromShippingMethod(shippingMethod) ?? detectCarrier(trackingNumber) ?? '新竹物流'
}

export function extractTrackingCandidates(text: string): string[] {
  const found = new Set<string>()
  for (const re of [/\b\d{10}\b/g, /\b\d{12}\b/g, /\b\d{7,15}\b/g]) {
    for (const m of text.matchAll(re)) {
      const n = digitsOnly(m[0])
      if (n.length >= 7 && n.length <= 15) found.add(n)
    }
  }
  return [...found]
}
