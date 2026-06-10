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

export function taipeiCurrentYearMonth(): string {
  return taipeiMonthRange().start.slice(0, 7)
}

export function taipeiMonthRangeFor(yearMonth: string): {
  start: string
  end: string
  dayOfMonth: number
  year_month: string
} {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim())
  if (!match) throw new Error('month 格式須為 YYYY-MM')
  const y = match[1]
  const m = match[2]
  const start = `${y}-${m}-01`
  const current = taipeiMonthRange()
  const isCurrentMonth = start.slice(0, 7) === current.start.slice(0, 7)
  if (isCurrentMonth) {
    return { start: current.start, end: current.end, dayOfMonth: current.dayOfMonth, year_month: `${y}-${m}` }
  }
  const lastDay = new Date(Number(y), Number(m), 0).getDate()
  const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`
  return { start, end, dayOfMonth: lastDay, year_month: `${y}-${m}` }
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim())
  if (!match) throw new Error('month 格式須為 YYYY-MM')
  const y = Number(match[1])
  const m = Number(match[2])
  const d = new Date(y, m - 1 + deltaMonths, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function recentYearMonths(count: number): string[] {
  const months: string[] = []
  let cur = taipeiCurrentYearMonth()
  for (let i = 0; i < count; i++) {
    months.push(cur)
    cur = shiftYearMonth(cur, -1)
  }
  return months
}
