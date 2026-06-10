export type Carrier = '新竹物流' | '黑貓' | '超商'

const digitsOnly = (s: string) => s.replace(/\D/g, '')

export function compactTrackingRaw(raw: string): string {
  return raw.trim().replace(/\s+/g, '')
}

export function normalizeTrackingNumber(raw: string, carrier?: Carrier | null): string {
  const compact = compactTrackingRaw(raw)
  if (carrier === '超商' || /[a-zA-Z]/.test(compact)) {
    return compact.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  }
  return digitsOnly(compact)
}

export function carrierFromShippingMethod(method: string | null | undefined): Carrier | null {
  const m = (method ?? '').trim()
  if (m === '新竹') return '新竹物流'
  if (m === '黑貓') return '黑貓'
  if (m === '超商') return '超商'
  return null
}

export function detectCarrier(trackingNumber: string): Carrier | null {
  const compact = compactTrackingRaw(trackingNumber)
  const alnum = compact.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const n = digitsOnly(compact)
  if (!n && !alnum) return null

  if (/^[A-Z0-9]{3}[A-Z0-9]{5,9}$/.test(alnum)) return '超商'
  if (/^\d{12}$/.test(n)) return '黑貓'
  if (/^\d{10}$/.test(n) && !/[a-zA-Z]/.test(compact)) return '新竹物流'
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
  for (const re of [/\b[A-Za-z0-9]{8,12}\b/g, /\b\d{10}\b/g, /\b\d{12}\b/g, /\b\d{7,15}\b/g]) {
    for (const m of text.matchAll(re)) {
      const compact = compactTrackingRaw(m[0])
      const carrier = detectCarrier(compact)
      const normalized = normalizeTrackingNumber(compact, carrier)
      if (normalized.length >= 7 && normalized.length <= 15) found.add(normalized)
    }
  }
  return [...found]
}
