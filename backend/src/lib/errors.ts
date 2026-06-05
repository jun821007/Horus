export function formatError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = (e as { message: unknown }).message
    if (typeof msg === 'string' && msg.length > 0) return msg
  }
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
