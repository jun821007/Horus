export function taipeiCurrentYearMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970'
  const m = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${y}-${m}`
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim())
  if (!match) return yearMonth
  const y = Number(match[1])
  const m = Number(match[2])
  const d = new Date(y, m - 1 + deltaMonths, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
