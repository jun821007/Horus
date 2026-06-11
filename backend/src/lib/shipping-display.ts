export type ParcelLine = {
  friend_name: string
  remark: string
}

function formatShippedAt(value: string): string {
  const raw = value.trim()
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
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

export function formatShippingDisplay(
  parcelItems: ParcelLine[],
  shippingAddress?: string | null,
  shippedAt?: string | null,
): string {
  const byName = new Map<string, string[]>()

  for (const item of parcelItems) {
    const name = (item.friend_name || '').trim() || '未知'
    const remark = (item.remark || '').trim()
    if (!remark) continue
    const list = byName.get(name) ?? []
    if (!list.includes(remark)) list.push(remark)
    byName.set(name, list)
  }

  const lines: string[] = []
  const address = (shippingAddress || '').trim()
  if (address) lines.push(`收件地址：${address}`)
  if (shippedAt?.trim()) lines.push(`發貨時間：${formatShippedAt(shippedAt)}`)

  if (lines.length > 0 && byName.size > 0) lines.push('')

  for (const [name, remarks] of byName.entries()) {
    lines.push(`${name} ${remarks.join('、')}`)
  }

  return lines.join('\n')
}
