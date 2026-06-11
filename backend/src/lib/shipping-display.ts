export type ParcelLine = {
  friend_name: string
  remark: string
}

export function formatShippingDisplay(
  parcelItems: ParcelLine[],
  shippingAddress?: string | null,
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

  for (const [name, remarks] of byName.entries()) {
    lines.push(`${name} ${remarks.join('、')}`)
  }

  return lines.join('\n')
}
