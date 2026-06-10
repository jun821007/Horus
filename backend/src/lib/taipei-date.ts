const TZ = 'Asia/Taipei'

export function taipeiYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function taipeiTomorrowYmd(): string {
  const today = taipeiYmd()
  const d = new Date(`${today}T12:00:00+08:00`)
  d.setDate(d.getDate() + 1)
  return taipeiYmd(d)
}

export function taipeiDayStartIso(ymd: string): string {
  return new Date(`${ymd}T00:00:00+08:00`).toISOString()
}

export function daysUntilTaipei(targetYmd: string, fromYmd = taipeiYmd()): number {
  const a = new Date(`${fromYmd}T12:00:00+08:00`).getTime()
  const b = new Date(`${targetYmd}T12:00:00+08:00`).getTime()
  return Math.round((b - a) / 86400000)
}
