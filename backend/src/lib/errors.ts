function errorCauseChain(e: unknown): string[] {
  const parts: string[] = []
  let cur: unknown = e
  for (let i = 0; i < 4 && cur; i++) {
    if (cur instanceof Error) {
      if (cur.message) parts.push(cur.message)
      cur = cur.cause
      continue
    }
    if (cur && typeof cur === 'object' && 'message' in cur) {
      const msg = (cur as { message: unknown }).message
      if (typeof msg === 'string' && msg) parts.push(msg)
      cur = (cur as { cause?: unknown }).cause
      continue
    }
    break
  }
  return parts
}

export function formatError(e: unknown): string {
  const chain = errorCauseChain(e)
  if (chain.length > 0) return chain.join(' → ')
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
