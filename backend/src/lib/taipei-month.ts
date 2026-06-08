import { config } from '../config.js'

export function taipeiMonthRange(): { start: string; end: string; dayOfMonth: number } {
  const tz = config.appTimeZone || 'Asia/Taipei'
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  const d = parts.find((p) => p.type === 'day')?.value ?? '01'
  const end = `${y}-${m}-${d}`
  const start = `${y}-${m}-01`
  const dayOfMonth = Number(d) || 1
  return { start, end, dayOfMonth }
}
