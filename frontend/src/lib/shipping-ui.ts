export function formatLastCheck(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Taipei',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
  return `${date} ${time}`
}

export function formatCargoStatus(statusText: string | null): string {
  if (!statusText?.trim()) return '暫無貨態'
  const t = statusText.trim()
  if (/查貨號碼|查貨時間/.test(t) && !/配送|配達|到著|集貨|發送|送達|正常配交|取件|持回|拒收/.test(t)) {
    return '暫無貨態明細'
  }
  return t
}
